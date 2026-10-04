import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidIban, maskIban, normalizeIban } from "@/lib/iban";

export type PayoutDetails = {
  iban: string;
  account_holder: string;
  updated_at: string;
} | null;

export type PayoutListRow = {
  user_id: string;
  name: string;
  email: string | null;
  iban: string | null;
  account_holder: string | null;
  updated_at: string | null;
};

async function rolesOf(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Response("Forbidden", { status: 403 });
  return (data || []).map((r: { role: string }) => r.role);
}

/** Eigene Bankverbindung für Übungsleitergelder (nur mit Rolle Trainer:in). */
export const getMyPayoutDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ details: PayoutDetails }> => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("trainer")) throw new Response("Forbidden", { status: 403 });
    const { data } = await context.supabase
      .from("trainer_payout_details")
      .select("iban,account_holder,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { details: data ?? null };
  });

/**
 * Speichert die eigene Bankverbindung. Ändert sich eine bestehende Angabe, geht eine Hinweis-Mail an den
 * Vorstand (ohne vollständige IBAN, da das Versandprotokoll den Mailtext speichert) und der Vorgang wird im
 * Verwaltungsprotokoll vermerkt.
 */
export const saveMyPayoutDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        iban: z.string().min(1).max(60),
        accountHolder: z.string().trim().min(1, "Bitte Kontoinhaber:in angeben.").max(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ details: PayoutDetails; notified: boolean }> => {
    const { supabase, userId } = context;
    const roles = await rolesOf(supabase, userId);
    if (!roles.includes("trainer")) throw new Response("Forbidden", { status: 403 });

    const iban = normalizeIban(data.iban);
    if (!isValidIban(iban)) {
      throw new Error("Diese IBAN ist ungültig. Bitte Eingabe prüfen.");
    }
    const holder = data.accountHolder.trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("trainer_payout_details")
      .select("iban,account_holder")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.iban === iban && existing.account_holder === holder) {
      const { data: unchanged } = await supabaseAdmin
        .from("trainer_payout_details")
        .select("iban,account_holder,updated_at")
        .eq("user_id", userId)
        .single();
      return { details: unchanged, notified: false };
    }

    const { data: saved, error } = await supabaseAdmin
      .from("trainer_payout_details")
      .upsert({ user_id: userId, iban, account_holder: holder }, { onConflict: "user_id" })
      .select("iban,account_holder,updated_at")
      .single();
    if (error) throw new Error("Speichern fehlgeschlagen. Bitte später erneut versuchen.");

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(supabase, userId, {
      action: existing ? "trainer.payout.changed" : "trainer.payout.created",
      entity: "trainer_payout_details",
      entity_id: userId,
      metadata: {
        iban: maskIban(iban),
        previous_iban: existing ? maskIban(existing.iban) : null,
        holder_changed: existing ? existing.account_holder !== holder : null,
      },
    });

    let notified = false;
    if (existing) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", userId)
        .maybeSingle();
      const name =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.email ||
        "Trainer:in";
      const { queueTemplateEmail } = await import("@/lib/email-send.server");
      const res = await queueTemplateEmail({
        templateName: "trainer-payout-changed",
        idempotencyKey: `trainer-payout-changed-${userId}-${Date.now()}`,
        senderUserId: userId,
        templateData: {
          trainer_name: name,
          trainer_email: profile?.email ?? "",
          old_iban_masked: maskIban(existing.iban),
          new_iban_masked: maskIban(iban),
          iban_changed: existing.iban !== iban,
          holder_changed: existing.account_holder !== holder,
          changed_at: new Date().toISOString(),
        },
      });
      notified = res.queued;
    }

    return { details: saved, notified };
  });

/**
 * Vorstand/Admin: Bankverbindungen aller Trainer:innen (auch derer, die noch keine hinterlegt haben)
 * für die Abrechnung der Übungsleitergelder. Jeder Abruf wird im Verwaltungsprotokoll vermerkt.
 */
export const listPayoutDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: PayoutListRow[] }> => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roleRows }, { data: details }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "trainer"),
      supabaseAdmin.from("trainer_payout_details").select("user_id,iban,account_holder,updated_at"),
    ]);

    const ids = Array.from(
      new Set([
        ...(roleRows ?? []).map((r) => r.user_id as string),
        ...(details ?? []).map((d) => d.user_id as string),
      ]),
    );
    if (ids.length === 0) return { rows: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", ids);
    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    const detailById = new Map((details ?? []).map((d) => [d.user_id as string, d]));

    const rows: PayoutListRow[] = ids
      .map((id) => {
        const p = profileById.get(id);
        const d = detailById.get(id);
        return {
          user_id: id,
          name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Unbekannt",
          email: p?.email ?? null,
          iban: d?.iban ?? null,
          account_holder: d?.account_holder ?? null,
          updated_at: d?.updated_at ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(supabase, userId, {
      action: "trainer.payout.listed",
      entity: "trainer_payout_details",
      metadata: { count: rows.filter((r) => r.iban).length },
    });

    return { rows };
  });
