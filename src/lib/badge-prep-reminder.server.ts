/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
// Server-only: Erinnerung an die Trainer:innen zwei Tage vor der letzten Kursstunde.
// Die Mail enthält bewusst keine Namen oder Geburtsdaten, nur die Zahlen und den Link zur Übersichtsseite.
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";
import { addDays, longDate } from "@/lib/dienstplan";
import { queueTemplateEmail } from "@/lib/email-send.server";
import { pushToTrainer } from "@/lib/trainer-push.server";
import { lastSessionDate, loadCourseBadgePrep } from "@/lib/badge-prep.server";
import { summarizeReady } from "@/lib/badge-prep";

const SITE = "https://sicher-schwimmen.com";
/** So viele Tage vor der letzten Stunde geht die Erinnerung raus (Cron läuft um 18 Uhr, also ca. 40 Stunden vorher). */
export const BADGE_PREP_DAYS_BEFORE = 2;

export async function runBadgePrepReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const today = todayBerlinIso();
  const target = addDays(today, BADGE_PREP_DAYS_BEFORE);

  // Kurse, die in den nächsten Tagen enden (großzügig, dann nach letztem Termin filtern)
  const courses = await fetchAll<any>((f, t) =>
    db
      .from("courses")
      .select("id,name,location,trainer_id,ends_on,archived_at,course_sessions(id,session_date,assigned_trainer_id)")
      .is("archived_at", null)
      .gte("ends_on", today)
      .lte("ends_on", addDays(today, 30))
      .order("id")
      .range(f, t),
  );
  // Kurse ohne ends_on, aber mit Terminen werden hier nicht erfasst: ends_on wird beim Anlegen gesetzt.
  const ending = courses.filter(
    (c) =>
      lastSessionDate(
        ((c.course_sessions ?? []) as Array<{ session_date: string }>).map((s) => s.session_date),
        c.ends_on,
      ) === target,
  );
  if (ending.length === 0) return { courses: 0, sent: 0 };

  const optOut = new Set<string>();
  try {
    const rows = await fetchAll<any>((f, t) =>
      db.from("trainer_settings").select("trainer_id").eq("reminders", false).order("trainer_id").range(f, t),
    );
    for (const r of rows) optOut.add(r.trainer_id);
  } catch {
    /* ohne Einstellungen: alle erinnern */
  }

  const sessionIds = ending.flatMap((c) => (c.course_sessions ?? []).map((s: any) => s.id as string));
  const assignments = await fetchIn<{ session_id: string; trainer_id: string }>(
    sessionIds,
    (chunk, f, t) =>
      db
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", chunk)
        .order("id")
        .range(f, t),
  );
  const courseOfSession = new Map<string, string>();
  for (const c of ending) for (const s of c.course_sessions ?? []) courseOfSession.set(s.id, c.id);

  // Trainer je Kurs
  const trainersByCourse = new Map<string, Set<string>>();
  const addTrainer = (courseId: string, trainerId: string | null | undefined) => {
    if (!trainerId || optOut.has(trainerId)) return;
    const set = trainersByCourse.get(courseId) ?? new Set<string>();
    set.add(trainerId);
    trainersByCourse.set(courseId, set);
  };
  for (const c of ending) {
    addTrainer(c.id, c.trainer_id);
    for (const s of c.course_sessions ?? []) addTrainer(c.id, s.assigned_trainer_id);
  }
  for (const a of assignments) {
    const courseId = courseOfSession.get(a.session_id);
    if (courseId) addTrainer(courseId, a.trainer_id);
  }

  const trainerIds = [...new Set([...trainersByCourse.values()].flatMap((s) => [...s]))];
  const profiles = await fetchIn<any>(trainerIds, (chunk, f, t) =>
    db.from("profiles").select("id,first_name,email").in("id", chunk).order("id").range(f, t),
  );
  const profileById = new Map(profiles.map((p) => [p.id as string, p]));

  let sent = 0;
  for (const c of ending) {
    const prep = await loadCourseBadgePrep(c.id);
    if (!prep || prep.ready.length + prep.siggi.length === 0) continue;
    const lastDay = prep.course.last_session ?? target;

    for (const trainerId of trainersByCourse.get(c.id) ?? []) {
      const p = profileById.get(trainerId);
      if (!p?.email) continue;
      const url = `${SITE}/trainer/abzeichen/${c.id}`;
      const sections: { title: string; items: string[] }[] = [];
      if (prep.ready.length)
        sections.push({
          title: `${prep.ready.length} Abzeichen vorbereiten`,
          items: summarizeReady(prep.ready),
        });
      if (prep.siggi.length)
        sections.push({
          title: `${prep.siggi.length} × Siggi-Pass`,
          items: ["Für Kinder, die noch kein Abzeichen geschafft haben"],
        });

      await pushToTrainer(trainerId, {
        title: "Übermorgen letzte Kursstunde",
        body: `${prep.course.name}: Bitte Abzeichen und Siggi-Pässe vorbereiten.`,
        url: `/trainer/abzeichen/${c.id}`,
        tag: `badge-prep-${c.id}`,
      });
      const r = await queueTemplateEmail({
        templateName: "dienstplan-trainer",
        recipientEmail: p.email,
        idempotencyKey: `badge-prep-${c.id}-${trainerId}-${lastDay}`,
        templateData: {
          name: p.first_name ?? undefined,
          heading: "Letzte Kursstunde: Abzeichen vorbereiten",
          subject: `Letzte Stunde ${longDate(lastDay)}: Abzeichen vorbereiten (${prep.course.name})`,
          intro: `Achtung, am ${longDate(lastDay)} ist die letzte Kursstunde von „${prep.course.name}“. Bitte die Abzeichen und Siggi-Pässe vorbereiten. Wer genau welches Abzeichen bekommt (mit Geburtsdatum und Datum), steht im Trainerbereich.`,
          sections,
          note: "Falls in der letzten Stunde noch jemand ein Abzeichen schafft: bitte 2–3 Blanko-Abzeichen mitnehmen.",
          url,
          button: "Übersicht der Abzeichen öffnen",
        },
      });
      if (r.queued) sent++;
    }
  }
  return { courses: ending.length, sent };
}
