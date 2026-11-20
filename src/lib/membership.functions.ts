import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { escapeLike } from "@/lib/like";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["pending", "active", "suspended", "terminated"] as const;

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!isStaff) throw new Response("Forbidden", { status: 403 });
}

export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const email = context.claims?.email as string | undefined;

    const own = await supabase
      .from("memberships")
      .select("id,status,membership_type,first_name,last_name,email")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (own.data) return own.data;

    if (!email) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("memberships")
      .select("id,status,membership_type,first_name,last_name,email,user_id")
      .ilike("email", escapeLike(email))
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;

    await supabaseAdmin.from("memberships").update({ user_id: userId }).eq("id", row.id);
    return {
      id: row.id,
      status: row.status,
      membership_type: row.membership_type,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
    };
  });

export const setMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("memberships")
      .update({
        status: data.status,
        approved_at: data.status === "active" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: `membership.${data.status}`,
      entity: "memberships",
      entity_id: data.id,
    });
    if (data.status === "active") {
      try {
        // Beginn festlegen (Satzung § 3), danach die Aufnahmebestätigung mit allen Angaben versenden
        const { applyStartOnFirstApproval, sendMembershipConfirmationEmail } =
          await import("@/lib/membership-confirmation.server");
        await applyStartOnFirstApproval(data.id);
        await sendMembershipConfirmationEmail({
          membershipId: data.id,
          senderUserId: context.userId,
        });
      } catch (e) {
        console.error("[setMembershipStatus] confirmation mail failed", e);
      }
    }
    let repriced = 0;
    if (data.status === "active") {
      try {
        // Offene Buchungen dieser Familie auf den Mitgliedspreis umstellen
        const { repriceMemberParticipants } = await import("@/lib/membership-lookup.server");
        const res = await repriceMemberParticipants();
        repriced = res.updated.length;
        if (repriced > 0 || res.alreadyPaid.length > 0) {
          await logAudit(context.supabase, context.userId, {
            action: "membership.repriced",
            entity: "memberships",
            entity_id: data.id,
            metadata: {
              updated: res.updated,
              alreadyPaid: res.alreadyPaid,
              keptPrice: res.keptPrice,
            },
          });
        }
      } catch (e) {
        console.error("[setMembershipStatus] reprice failed", e);
      }
    }
    return { ok: true, repriced };
  });

/** Gleicht bei offenen Buchungen von Mitgliedern die Kursgebühr auf den Mitgliedspreis an. */
export const syncMemberPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ courseId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { repriceMemberParticipants } = await import("@/lib/membership-lookup.server");
    const res = await repriceMemberParticipants({ courseId: data.courseId ?? null });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "membership.prices_synced",
      entity: "course_participants",
      entity_id: data.courseId ?? undefined,
      metadata: { updated: res.updated, alreadyPaid: res.alreadyPaid, keptPrice: res.keptPrice },
    });
    return res;
  });

export const deleteMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("memberships").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "membership.deleted",
      entity: "memberships",
      entity_id: data.id,
    });
    return { ok: true };
  });

const ISO_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** „Mitglied ab“ und „gültig bis“ (Kündigung zum Jahresende) setzen; leer = keine Einschränkung. */
export const setMembershipDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        start_date: ISO_DAY.nullable(),
        valid_until: ISO_DAY.nullable(),
      })
      .refine((v) => !v.start_date || !v.valid_until || v.valid_until >= v.start_date, {
        message: "„Gültig bis“ liegt vor „Mitglied ab“",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("memberships")
      .update({ start_date: data.start_date, valid_until: data.valid_until } as never)
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "membership.dates_set",
      entity: "memberships",
      entity_id: data.id,
      metadata: { start_date: data.start_date, valid_until: data.valid_until },
    });
    return { ok: true };
  });

/**
 * Buchungen mit Mitgliedspreis, deren Mitgliedschaft zum Kursstart nicht (mehr) gilt – z. B. weil der
 * Antrag zurückgezogen wurde, nicht zustande kam oder zum Jahresende gekündigt war. Nur Anzeige.
 */
export const listMemberPriceMismatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMemberships, matchMembership } = await import("@/lib/membership-lookup.server");
    const { todayBerlinIso } = await import("@/lib/format");
    const rows = await loadMemberships();
    const today = todayBerlinIso();
    const { data, error } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,price_amount,paid,course_id,courses!course_participants_course_id_fkey(name,starts_on,ends_on,price_non_member,course_programs(price_non_member))",
      )
      .eq("is_member", true)
      .in("status", ["confirmed", "waiting"]);
    if (error) throw new Response(error.message, { status: 500 });
    const out: Array<{
      id: string;
      participant: string;
      email: string | null;
      course: string;
      startsOn: string | null;
      current: number | null;
      normal: number | null;
      difference: number | null;
      paid: boolean;
    }> = [];
    for (const p of (data ?? []) as any[]) {
      const c = p.courses;
      if (!c || (c.ends_on && c.ends_on < today)) continue;
      const m = matchMembership(rows, {
        email: p.participant_email,
        childName: p.participant_name,
        courseStart: c.starts_on ?? null,
      });
      if (m.isMember === true) continue;
      const normal = c.price_non_member ?? c.course_programs?.price_non_member ?? null;
      const current = p.price_amount == null ? null : Number(p.price_amount);
      out.push({
        id: p.id,
        participant: p.participant_name,
        email: p.participant_email ?? null,
        course: c.name,
        startsOn: c.starts_on ?? null,
        current,
        normal: normal == null ? null : Number(normal),
        difference: normal == null || current == null ? null : Number(normal) - current,
        paid: !!p.paid,
      });
    }
    return out;
  });

/**
 * Setzt eine Buchung nach Entscheidung des Vorstands auf den Normalpreis (kein Mitglied mehr).
 * Bereits bezahlte Buchungen: Preis und Status werden angepasst, die Differenz muss die Kasse anfordern.
 */
export const chargeNormalPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ participantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,price_amount,paid,internal_notes,is_member,courses!course_participants_course_id_fkey(price_non_member,course_programs(price_non_member))",
      )
      .eq("id", data.participantId)
      .maybeSingle();
    if (error || !p) throw new Response("Buchung nicht gefunden", { status: 404 });
    const c = (p as any).courses;
    const normal = c?.price_non_member ?? c?.course_programs?.price_non_member ?? null;
    if (normal == null) throw new Response("Kein Normalpreis hinterlegt", { status: 400 });
    const stamp = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
    const note = `[${stamp}] Mitgliedschaft zum Kursstart nicht gültig – Normalpreis ${Number(normal)} € (vorher ${(p as any).price_amount ?? "–"} €)${(p as any).paid ? "; bereits bezahlt, Differenz anfordern" : ""}.`;
    const { error: upErr } = await supabaseAdmin
      .from("course_participants")
      .update({
        is_member: false,
        price_amount: Number(normal),
        internal_notes: `${(p as any).internal_notes ? `${(p as any).internal_notes}\n` : ""}${note}`,
      } as never)
      .eq("id", data.participantId);
    if (upErr) throw new Response(upErr.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "membership.normal_price_applied",
      entity: "course_participants",
      entity_id: data.participantId,
    });
    return { ok: true, paid: !!(p as any).paid };
  });
