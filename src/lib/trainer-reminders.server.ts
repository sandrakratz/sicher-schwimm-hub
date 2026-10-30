/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
// Server-only: Erinnerungs-Mails an Trainer:innen.
// Täglich (Abend): Einsätze von morgen. Sonntags statt dessen die Wochenvorschau, dazu ablaufende Qualifikationen.
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { parseTimeRange } from "@/lib/ics";
import { todayBerlinIso } from "@/lib/format";
import { addDays, longDate, timeText } from "@/lib/dienstplan";
import {
  QUALIFICATION_WARN_DAYS,
  daysUntil,
  qualificationLabel,
} from "@/lib/trainer-qualifications";
import { queueTemplateEmail } from "@/lib/email-send.server";
import { pushToTrainer } from "@/lib/trainer-push.server";

const SITE = "https://sicher-schwimmen.com";

type Shift = { id: string; date: string; line: string };

export async function runTrainerReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const today = todayBerlinIso();
  const tomorrow = addDays(today, 1);
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const rangeEnd = isSunday ? addDays(today, 7) : tomorrow;

  // Wer keine Erinnerungen möchte (Tabelle kann fehlen, solange die Migration nicht eingespielt ist)
  const optOut = new Set<string>();
  try {
    const rows = await fetchAll<any>((f, t) =>
      db
        .from("trainer_settings")
        .select("trainer_id")
        .eq("reminders", false)
        .order("trainer_id")
        .range(f, t),
    );
    for (const r of rows) optOut.add(r.trainer_id);
  } catch {
    /* ohne Einstellungen: alle erinnern */
  }

  const sessions = await fetchAll<any>((f, t) =>
    db
      .from("course_sessions")
      .select(
        "id,session_index,session_date,start_time,end_time,assigned_trainer_id,courses!inner(name,location,schedule,duration,trainer_id,archived_at)",
      )
      .is("courses.archived_at", null)
      .gte("session_date", tomorrow)
      .lte("session_date", rangeEnd)
      .order("session_date")
      .order("id")
      .range(f, t),
  );
  const assignments = await fetchIn<{ session_id: string; trainer_id: string }>(
    sessions.map((s) => s.id),
    (chunk, f, t) =>
      db
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", chunk)
        .order("id")
        .range(f, t),
  );
  const unconfirmed = new Set<string>();
  try {
    const rows = await fetchIn<{ session_id: string; trainer_id: string }>(
      sessions.map((s) => s.id),
      (chunk, f, t) =>
        db
          .from("course_session_assignments")
          .select("session_id,trainer_id")
          .is("confirmed_at", null)
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
    );
    for (const r of rows) unconfirmed.add(`${r.session_id}|${r.trainer_id}`);
  } catch {
    /* Spalte noch nicht vorhanden */
  }

  const byTrainer = new Map<string, Shift[]>();
  const unconfirmedBy = new Map<string, number>();
  const add = (trainer: string, s: any) => {
    const c = s.courses ?? {};
    const t = s.start_time
      ? {
          start: String(s.start_time).slice(0, 5),
          end: s.end_time ? String(s.end_time).slice(0, 5) : null,
        }
      : parseTimeRange(c.schedule, c.duration);
    const list = byTrainer.get(trainer) ?? [];
    if (list.some((x) => x.id === s.id)) return;
    list.push({
      id: s.id,
      date: s.session_date,
      line: `${longDate(s.session_date)}, ${timeText({ start: t?.start ?? null, end: t?.end ?? null })}: ${c.name ?? "Kurs"} (${s.session_index}. Termin)${c.location ? `, ${c.location}` : ""}`,
    });
    byTrainer.set(trainer, list);
    if (unconfirmed.has(`${s.id}|${trainer}`))
      unconfirmedBy.set(trainer, (unconfirmedBy.get(trainer) ?? 0) + 1);
  };
  const sessionById = new Map(sessions.map((s) => [s.id as string, s]));
  for (const a of assignments) {
    const s = sessionById.get(a.session_id);
    if (s) add(a.trainer_id, s);
  }
  for (const s of sessions) {
    if (s.assigned_trainer_id) add(s.assigned_trainer_id, s);
    if (s.courses?.trainer_id) add(s.courses.trainer_id, s);
  }

  // Ablaufende Qualifikationen (nur sonntags)
  const warnBy = new Map<string, string[]>();
  if (isSunday) {
    try {
      const quals = await fetchAll<any>((f, t) =>
        db
          .from("trainer_qualifications")
          .select("trainer_id,kind,valid_until,note")
          .not("valid_until", "is", null)
          .order("trainer_id")
          .order("kind")
          .range(f, t),
      );
      for (const q of quals) {
        const d = daysUntil(q.valid_until, today);
        if (d === null || d > QUALIFICATION_WARN_DAYS) continue;
        const label = q.kind === "sonstiges" && q.note ? q.note : qualificationLabel(q.kind);
        const text =
          d < 0 ? `${label}: seit ${-d} Tagen abgelaufen` : `${label}: läuft in ${d} Tagen ab`;
        warnBy.set(q.trainer_id, [...(warnBy.get(q.trainer_id) ?? []), text]);
      }
    } catch {
      /* Tabelle noch nicht vorhanden */
    }
  }

  const ids = [...new Set([...byTrainer.keys(), ...warnBy.keys()])].filter((id) => !optOut.has(id));
  const profiles = await fetchIn<any>(ids, (chunk, f, t) =>
    db.from("profiles").select("id,first_name,email").in("id", chunk).order("id").range(f, t),
  );

  let sent = 0;
  for (const p of profiles) {
    if (!p.email) continue;
    const all = (byTrainer.get(p.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const shifts = isSunday ? all : all.filter((s) => s.date === tomorrow);
    const warnings = warnBy.get(p.id) ?? [];
    if (shifts.length === 0 && warnings.length === 0) continue;

    const sections: { title: string; items: string[] }[] = [];
    if (shifts.length)
      sections.push({
        title: isSunday ? "Deine Einsätze in den nächsten 7 Tagen" : "Dein Einsatz morgen",
        items: shifts.map((s) => s.line),
      });
    if (warnings.length) sections.push({ title: "Bitte erneuern", items: warnings });
    const open = unconfirmedBy.get(p.id) ?? 0;

    await pushToTrainer(p.id, {
      title: isSunday ? "Deine Woche im Verein" : "Morgen: Dein Einsatz",
      body: shifts.length
        ? shifts
            .slice(0, 3)
            .map((s) => s.line)
            .join("\n")
        : warnings.join(" · "),
      url: "/trainer",
      tag: `trainer-reminder-${today}`,
    });
    const r = await queueTemplateEmail({
      templateName: "dienstplan-trainer",
      recipientEmail: p.email,
      idempotencyKey: `trainer-reminder-${isSunday ? "week" : "eve"}-${p.id}-${today}`,
      templateData: {
        name: p.first_name ?? undefined,
        heading: isSunday ? "Deine Woche im Verein" : "Erinnerung: Dein Einsatz morgen",
        intro: shifts.length
          ? "Das steht bei dir an. Kannst du doch nicht, sag bitte im Trainerbereich ab – jederzeit, auch kurzfristig."
          : "Eine kurze Erinnerung.",
        sections,
        note: open
          ? `${open} Einsatz${open === 1 ? " ist" : "ätze sind"} noch nicht von dir bestätigt.`
          : null,
        url: `${SITE}/trainer`,
        button: "Zum Trainerbereich",
      },
    });
    if (r.queued) sent++;
  }
  return { trainers: ids.length, sent };
}
