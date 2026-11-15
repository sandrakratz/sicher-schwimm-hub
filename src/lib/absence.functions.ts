import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { todayBerlinIso } from "@/lib/format";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Abmeldung einzelner Kurstermine durch die Eltern über den geheimen Link (push_token der Buchung) –
 * kein Konto nötig. Die Abmeldung wird als „entschuldigt“ in course_attendance eingetragen, damit die
 * Trainer sie ohne weitere Änderung in der Anwesenheitsliste sehen. Schreibzugriff nur serverseitig.
 */
export const PARENT_ABSENCE_NOTE = "Von Eltern abgemeldet";

const tokenSchema = z.string().regex(/^[a-f0-9]{20,80}$/);

async function loadByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("course_participants")
    .select("id,course_id,participant_name,status")
    .eq("push_token", token)
    .maybeSingle();
  if (!p || p.status === "cancelled") return null;
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("name,archived_at")
    .eq("id", p.course_id)
    .maybeSingle();
  const { data: sessions } = await supabaseAdmin
    .from("course_sessions")
    .select("id,session_date,start_time")
    .eq("course_id", p.course_id)
    .gte("session_date", todayBerlinIso())
    .order("session_date", { ascending: true });
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const { data: att } = sessionIds.length
    ? await supabaseAdmin
        .from("course_attendance")
        .select("session_id,status,note,recorded_by")
        .eq("participant_id", p.id)
        .in("session_id", sessionIds)
    : { data: [] as any[] };
  return { p, course, sessions: sessions ?? [], att: att ?? [] };
}

export type AbsenceSession = { id: string; date: string; absent: boolean };

/** Öffentlich: Kind, Kurs und kommende Termine mit Abmelde-Status. */
export const getAbsenceInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const r = await loadByToken(data.token);
    if (!r) return { found: false as const };
    const absentIds = new Set(
      r.att.filter((a: any) => a.status === "excused").map((a: any) => a.session_id as string),
    );
    return {
      found: true as const,
      childName: r.p.participant_name as string | null,
      courseName: (r.course?.name ?? null) as string | null,
      sessions: r.sessions.map((s) => ({
        id: s.id as string,
        date: s.session_date as string,
        absent: absentIds.has(s.id as string),
      })) as AbsenceSession[],
    };
  });

/** Höchstzahl Familien je Klick (Abfragegrenze bei Cloudflare). Der Rest wird mit dem nächsten Klick gesendet. */
const INVITES_PER_RUN = 12;

/**
 * Vorstand: einmalige Info-Mail mit dem Abmelde-Link an alle Familien mit laufenden Kursen
 * (bereits gestartet, noch nicht beendet). Eine Mail je Adresse, Geschwister zusammen.
 * Wer die Mail schon bekommen hat, wird übersprungen.
 */
export const sendAbsenceInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newPushToken } = await import("@/lib/push.server");
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const today = todayBerlinIso();

    const { data: parts } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,push_token,created_at,courses!course_participants_course_id_fkey(name,starts_on,ends_on,archived_at)",
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    type Entry = {
      email: string;
      kids: { id: string; name: string | null; course: string | null; token: string | null }[];
    };
    const byEmail = new Map<string, Entry>();
    for (const p of parts ?? []) {
      const c = (p as any).courses;
      if (!c || c.archived_at) continue;
      if (!c.starts_on || c.starts_on > today) continue; // läuft noch nicht
      if (c.ends_on && c.ends_on < today) continue; // schon beendet
      const email = p.participant_email?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      const entry = byEmail.get(key) ?? { email, kids: [] };
      entry.kids.push({
        id: p.id as string,
        name: p.participant_name as string | null,
        course: c.name as string | null,
        token: (p.push_token as string | null) ?? null,
      });
      byEmail.set(key, entry);
    }

    // Wer die Info-Mail schon bekommen hat (gesendet oder bewusst unterdrückt)
    const keyOf = (email: string) => `absence-invite-${email}`;
    const done = new Set<string>();
    const keys = Array.from(byEmail.keys()).map(keyOf);
    for (let i = 0; i < keys.length; i += 200) {
      const { data: logRows } = await supabaseAdmin
        .from("email_send_log")
        .select("status,metadata")
        .eq("template_name", "absence-invite")
        .neq("status", "failed")
        .in("metadata->>idempotency_key", keys.slice(i, i + 200));
      for (const r of logRows ?? []) {
        const k = (r.metadata as { idempotency_key?: string } | null)?.idempotency_key;
        if (k) done.add(k);
      }
    }

    const open = Array.from(byEmail.entries()).filter(([email]) => !done.has(keyOf(email)));
    const batch = open.slice(0, INVITES_PER_RUN);

    let sent = 0;
    let failed = 0;
    for (const [email, entry] of batch) {
      for (const k of entry.kids) {
        if (!k.token) {
          k.token = newPushToken();
          await supabaseAdmin
            .from("course_participants")
            .update({ push_token: k.token })
            .eq("id", k.id);
        }
      }
      const r = await queueTemplateEmail({
        templateName: "absence-invite",
        recipientEmail: entry.email,
        idempotencyKey: keyOf(email),
        senderUserId: context.userId,
        skipLimitWarning: true,
        templateData: {
          children_links: entry.kids.map((k) => ({
            name: k.name,
            course: k.course,
            url: `https://sicher-schwimmen.com/abmelden?token=${k.token}`,
          })),
        },
      });
      if (r.queued) sent++;
      else failed++;
    }
    return { sent, failed, remaining: open.length - batch.length, families: byEmail.size };
  });

/** Öffentlich: Termine abmelden bzw. die Abmeldung zurücknehmen. */
export const setAbsence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenSchema,
        sessionIds: z.array(z.string().uuid()).min(1).max(60),
        absent: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const r = await loadByToken(data.token);
    if (!r) throw new Error("Link ungültig.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nur kommende Termine des eigenen Kurses.
    const allowed = new Set(r.sessions.map((s) => s.id as string));
    const ids = data.sessionIds.filter((id) => allowed.has(id));
    if (ids.length === 0) throw new Error("Termin nicht gefunden oder bereits vorbei.");

    if (data.absent) {
      // Was die Trainer schon erfasst haben (anwesend/gefehlt), bleibt unangetastet.
      const have = new Set(r.att.map((a: any) => a.session_id as string));
      const rows = ids
        .filter((id) => !have.has(id))
        .map((id) => ({
          session_id: id,
          participant_id: r.p.id,
          status: "excused" as const,
          note: PARENT_ABSENCE_NOTE,
          recorded_by: null,
        }));
      if (rows.length > 0) {
        const { error } = await supabaseAdmin
          .from("course_attendance")
          .upsert(rows, { onConflict: "session_id,participant_id", ignoreDuplicates: true });
        if (error) throw new Error("Speichern fehlgeschlagen.");
      }
    } else {
      // Zurücknehmen nur für Einträge, die von den Eltern stammen.
      const { error } = await supabaseAdmin
        .from("course_attendance")
        .delete()
        .eq("participant_id", r.p.id)
        .in("session_id", ids)
        .eq("status", "excused")
        .eq("note", PARENT_ABSENCE_NOTE)
        .is("recorded_by", null);
      if (error) throw new Error("Speichern fehlgeschlagen.");
    }
    return { ok: true as const };
  });
