/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, assertTeam } from "@/lib/auth-guards.server";
import { fetchIn } from "@/lib/fetch-all";
import { checkKeyOf } from "@/lib/trainer-qualifications";
import { fullName } from "@/lib/format";

const SITE = "https://sicher-schwimmen.com";

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const urlFor = (token: string) => `${SITE}/api/public/trainer-ics?token=${token}`;

/** Persönlicher Kalender-Link (legt den geheimen Token beim ersten Aufruf an). */
export const getMyCalendarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("trainer_calendar_tokens")
      .select("token")
      .eq("trainer_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.token) return { url: urlFor(data.token as string) };
    const token = newToken();
    const ins = await db
      .from("trainer_calendar_tokens")
      .insert({ trainer_id: context.userId, token });
    if (ins.error) throw new Error(ins.error.message);
    return { url: urlFor(token) };
  });

/** Neuer Link; der alte funktioniert danach nicht mehr (z. B. wenn er weitergegeben wurde). */
export const rotateMyCalendarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = newToken();
    const res = await (context.supabase as any)
      .from("trainer_calendar_tokens")
      .upsert({ trainer_id: context.userId, token, created_at: new Date().toISOString() });
    if (res.error) throw new Error(res.error.message);
    return { url: urlFor(token) };
  });

/** Eigene Einteilungen bestätigen („Ich habe es gesehen und kann“). */
export const confirmAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const ids = [...new Set(data.sessionIds)];
    let confirmed = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const res = await db
        .from("course_session_assignments")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("trainer_id", context.userId)
        .is("confirmed_at", null)
        .in("session_id", chunk)
        .select("session_id");
      if (res.error) throw new Error(res.error.message);
      confirmed += (res.data ?? []).length;
    }
    return { confirmed };
  });

/** Wer ist außer mir noch bei diesen Terminen eingeteilt? (Namen für „Mein Team“.) */
export const teamForSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionIds: z.array(z.string().uuid()).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Nur Team-Rollen (Trainer, Vorstand, Admin) dürfen Namen der Kolleg:innen sehen
    await assertTeam(context);

    const rows = await fetchIn<{ session_id: string; trainer_id: string }>(
      data.sessionIds,
      (chunk, f, t) =>
        db
          .from("course_session_assignments")
          .select("session_id,trainer_id")
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
    );
    const people = [...new Set(rows.map((r) => r.trainer_id))];
    const profiles = await fetchIn<any>(people, (chunk, f, t) =>
      db.from("profiles").select("id,first_name,last_name").in("id", chunk).order("id").range(f, t),
    );
    const name = new Map(
      profiles.map((p) => [p.id as string, fullName(p.first_name, p.last_name) || "Unbekannt"]),
    );
    const team: Record<string, { id: string; name: string }[]> = {};
    for (const r of rows)
      (team[r.session_id] ??= []).push({ id: r.trainer_id, name: name.get(r.trainer_id) ?? "?" });
    return { team };
  });

// ---------------------------------------------------------------------------------------------
// Qualifikationen: Übersicht für den Vorstand
// ---------------------------------------------------------------------------------------------

export type QualificationOverviewRow = {
  trainerId: string;
  name: string;
  email: string;
  qualifications: {
    id: string;
    kind: string;
    issued_on: string | null;
    valid_until: string | null;
    note: string | null;
    checked: boolean;
  }[];
};

/** Alle Trainer:innen mit ihren Nachweisen und dem Prüfstatus (nur Vorstand/Verwaltung). */
export const listQualificationOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QualificationOverviewRow[]> => {
    await assertStaff(context);
    const { loadQualificationOverview } = await import("@/lib/qualifications.server");
    return loadQualificationOverview();
  });

/** Vorstand: Nachweis als „geprüft“ markieren oder die Markierung entfernen. */
export const setQualificationChecked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trainerId: z.string().uuid(),
        qualificationId: z.string().uuid(),
        checked: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: q, error } = await db
      .from("trainer_qualifications")
      .select("kind,issued_on,valid_until")
      .eq("id", data.qualificationId)
      .eq("trainer_id", data.trainerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Kein Nachweis eingetragen");
    const key = checkKeyOf(q.kind as string, data.qualificationId);
    if (!data.checked) {
      const del = await db
        .from("trainer_qualification_checks")
        .delete()
        .eq("trainer_id", data.trainerId)
        .eq("kind", key);
      if (del.error) throw new Error(del.error.message);
      return { ok: true };
    }
    const res = await db.from("trainer_qualification_checks").upsert({
      trainer_id: data.trainerId,
      kind: key,
      stamp: `${q.issued_on ?? ""}|${q.valid_until ?? ""}`,
      checked_at: new Date().toISOString(),
      checked_by: context.userId,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
