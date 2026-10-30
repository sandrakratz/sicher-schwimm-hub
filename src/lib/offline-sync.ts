import { combineChildHint } from "@/lib/child-hint";
import { listMyTrainerCourses } from "@/lib/trainer-courses.functions";
import { teamForSessions } from "@/lib/trainer-extras.functions";
import { setAttendance } from "@/lib/attendance.functions";
import { addDays } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";
import { listQueue, removeFromQueue, saveSnapshot, type OfflineSession } from "@/lib/offline-store";

export type SnapshotRow = {
  id: string;
  session_date: string;
  session_index: number;
  start_time: string | null;
  end_time: string | null;
  courseId: string;
  course: { name: string; location: string | null } | null;
};

/** Tage im Voraus, die offline verfügbar sind. */
export const OFFLINE_DAYS = 3;

/** Baut den Offline-Stand aus den eigenen Einsätzen der nächsten Tage und speichert ihn auf dem Gerät. */
export async function refreshOfflineSnapshot(rows: SnapshotRow[], userId: string) {
  const today = todayBerlinIso();
  const last = addDays(today, OFFLINE_DAYS - 1);
  const mine = rows.filter((r) => r.session_date >= today && r.session_date <= last);

  const [courses, teams] = await Promise.all([
    mine.length ? listMyTrainerCourses() : Promise.resolve([]),
    mine.length
      ? teamForSessions({ data: { sessionIds: mine.map((r) => r.id) } })
          .then((r) => r.team)
          .catch(() => ({}) as Record<string, { id: string; name: string }[]>)
      : Promise.resolve({} as Record<string, { id: string; name: string }[]>),
  ]);
  const byCourse = new Map(courses.map((c) => [c.id, c]));

  const sessions: OfflineSession[] = mine.map((r) => ({
    id: r.id,
    courseId: r.courseId,
    courseName: r.course?.name ?? "Kurs",
    location: r.course?.location ?? null,
    date: r.session_date,
    start: r.start_time ? r.start_time.slice(0, 5) : null,
    end: r.end_time ? r.end_time.slice(0, 5) : null,
    index: r.session_index,
    team: (teams[r.id] ?? []).filter((p) => p.id !== userId).map((p) => p.name),
    participants: (byCourse.get(r.courseId)?.participants ?? [])
      .filter((p) => p.status !== "cancelled")
      .map((p) => ({
        id: p.id,
        name: p.name || "—",
        hint: combineChildHint(p.notes, p.health_info),
      })),
  }));

  await saveSnapshot({ userId, generatedAt: new Date().toISOString(), sessions });
  return sessions.length;
}

/** Überträgt offline erfasste Anwesenheiten. Bei Netzfehlern bleibt der Rest in der Warteschlange. */
export async function syncQueue(): Promise<{ sent: number; left: number }> {
  const queue = (await listQueue()).sort((a, b) => a.at - b.at);
  let sent = 0;
  for (const m of queue) {
    try {
      await setAttendance({
        data: { sessionId: m.sessionId, participantId: m.participantId, status: m.status },
      });
      await removeFromQueue(m.key);
      sent++;
    } catch (e) {
      // Kein Netz: abbrechen. Dauerhafte Fehler (z. B. nicht mehr zuständig): Eintrag verwerfen.
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      const msg = e instanceof Error ? e.message : "";
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) break;
      await removeFromQueue(m.key);
    }
  }
  return { sent, left: (await listQueue()).length };
}
