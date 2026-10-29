/* eslint-disable @typescript-eslint/no-explicit-any -- Tabelle adult_course_interests steht erst nach der Migration in den generierten Supabase-Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADULT_COURSE_SLUG,
  INTEREST_STATUS_KEYS,
  interestInputSchema,
  type InterestStatus,
} from "@/lib/adult-course";

export type AdultInterest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  swim_level: "cannot" | "unsure" | "basics";
  saturday_availability: "flexible" | "morning" | "specific";
  price_preference: "member_159" | "non_member_179" | "check_dates";
  member_status_stated: "yes" | "no" | "unsure" | null;
  is_member: boolean | null;
  message: string | null;
  status: InterestStatus;
  admin_notes: string | null;
  created_at: string;
};

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!isStaff) throw new Error("Forbidden");
}

/**
 * Öffentliche, unverbindliche Interessenbekundung (ohne Login).
 * Erzeugt nur einen Eintrag in adult_course_interests – keine Buchung, keine Zahlung,
 * keine Mitgliedschaft, keinen Wartelisten-Eintrag und keine automatische Platzvergabe.
 */
export const submitAdultInterest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => interestInputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeEmail } = await import("@/lib/blocklist.server");
    const { resolveMembership } = await import("@/lib/membership-lookup.server");
    const emailNorm = normalizeEmail(data.email);

    const { data: program } = await supabaseAdmin
      .from("course_programs")
      .select("id")
      .eq("slug", ADULT_COURSE_SLUG)
      .eq("is_public", true)
      .maybeSingle();
    if (!program) throw new Error("Das Kursangebot ist derzeit nicht verfügbar.");

    // Doppelte Bekundung (gleiche E-Mail): nichts überschreiben, Bestätigung bleibt gleich.
    const { data: existing } = await (supabaseAdmin as any)
      .from("adult_course_interests")
      .select("id")
      .eq("email_norm", emailNorm)
      .eq("program_id", program.id)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true as const };

    // Mitgliedsstatus aus der bestehenden Mitgliederverwaltung (nur Information, kein Preisrecht)
    let isMember: boolean | null = null;
    try {
      isMember = (await resolveMembership({ email: emailNorm })).isMember;
    } catch (err) {
      console.error("adult interest: membership lookup failed", err);
    }

    const { error } = await (supabaseAdmin as any).from("adult_course_interests").insert({
      program_id: program.id,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      email_norm: emailNorm,
      phone: data.phone || null,
      swim_level: data.swimLevel,
      saturday_availability: data.saturdayAvailability,
      price_preference: data.pricePreference,
      member_status_stated: data.memberStatus ?? null,
      is_member: isMember,
      message: data.message || null,
    });
    // Parallele Doppel-Klicks: eindeutiger Index greift, Ergebnis bleibt "ok"
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true as const };
  });

export const listAdultInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("adult_course_interests")
      .select(
        "id,first_name,last_name,email,phone,swim_level,saturday_availability,price_preference,member_status_stated,is_member,message,status,admin_notes,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { entries: (data ?? []) as AdultInterest[] };
  });

export const updateAdultInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(INTEREST_STATUS_KEYS).optional(),
        adminNotes: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.adminNotes !== undefined) patch.admin_notes = data.adminNotes || null;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("adult_course_interests")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "adult_interest.updated",
      entity: "adult_course_interests",
      entity_id: data.id,
      metadata: { status: data.status ?? null },
    });
    return { ok: true as const };
  });

export const deleteAdultInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("adult_course_interests")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "adult_interest.deleted",
      entity: "adult_course_interests",
      entity_id: data.id,
    });
    return { ok: true as const };
  });
