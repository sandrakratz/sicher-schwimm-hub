import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) });

export type TransferSnapshot = {
  child_name: string | null;
  old_course: string;
  new_course: string;
  new_schedule: string | null;
  new_location: string | null;
  sessions: string[];
  reason: string | null;
  amount_due: string | null;
  refund: string | null;
  due_date: string | null;
};

/** Öffentlich über geheimen Link: zeigt, welcher Umbuchung zugestimmt werden soll. */
export const getTransferConsent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("course_transfer_consents")
      .select("status,confirmed_at,snapshot")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { found: false as const };
    return {
      found: true as const,
      done: row.status === "confirmed",
      confirmedAt: (row.confirmed_at as string | null) ?? null,
      snapshot: row.snapshot as TransferSnapshot,
    };
  });

/** Öffentlich über geheimen Link: hält die Zustimmung der Eltern fest (einmalig, nicht überschreibbar). */
export const confirmTransferConsent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: row } = await sb
      .from("course_transfer_consents")
      .select("id,status,confirmed_at,participant_id,snapshot")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Link ungültig.");
    if (row.status === "confirmed")
      return { ok: true as const, already: true, confirmedAt: row.confirmed_at as string };

    const now = new Date().toISOString();
    // Nur wenn noch offen – verhindert doppeltes Setzen bei parallelen Klicks.
    const { data: upd, error } = await sb
      .from("course_transfer_consents")
      .update({ status: "confirmed", confirmed_at: now })
      .eq("id", row.id)
      .eq("status", "open")
      .select("id");
    if (error) throw new Error("Zustimmung konnte nicht gespeichert werden.");
    if (!upd?.length) {
      const { data: cur } = await sb
        .from("course_transfer_consents")
        .select("confirmed_at")
        .eq("id", row.id)
        .maybeSingle();
      return {
        ok: true as const,
        already: true,
        confirmedAt: (cur?.confirmed_at as string | null) ?? now,
      };
    }

    // Vermerk in den internen Notizen der Buchung (für Verein und Trainer:innen sichtbar).
    const { formatDateTimeBerlin } = await import("@/lib/format");
    const { data: p } = await sb
      .from("course_participants")
      .select("internal_notes")
      .eq("id", row.participant_id)
      .maybeSingle();
    const snap = row.snapshot as TransferSnapshot;
    const line = `Zustimmung der Eltern zur Umbuchung „${snap.old_course}“ → „${snap.new_course}“ per E-Mail-Link am ${formatDateTimeBerlin(now)}.`;
    await sb
      .from("course_participants")
      .update({ internal_notes: [p?.internal_notes, line].filter(Boolean).join("\n") })
      .eq("id", row.participant_id);

    return { ok: true as const, already: false, confirmedAt: now };
  });

/** Zustimmungsstatus für eine Liste von Buchungen (Teilnehmerliste im Verein). */
export const listTransferConsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ participantIds: z.array(z.string().uuid()).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    type Row = {
      participant_id: string;
      status: string;
      confirmed_at: string | null;
      reminded_at: string | null;
    };
    if (!data.participantIds.length) return [] as Row[];
    const { data: rows } = await (supabaseAdmin as any)
      .from("course_transfer_consents")
      .select("participant_id,status,confirmed_at,reminded_at")
      .in("participant_id", data.participantIds);
    return (rows ?? []) as Row[];
  });
