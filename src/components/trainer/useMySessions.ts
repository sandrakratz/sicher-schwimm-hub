import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { todayBerlinIso } from "@/lib/format";
import { fetchAll, fetchIn } from "@/lib/fetch-all";

/** Ein eigener Kurstermin (eingeteilt, Termin-Trainer:in oder Kurstrainer:in). */
export type MySessionRow = {
  id: string;
  session_date: string;
  session_index: number;
  start_time: string | null;
  end_time: string | null;
  courseId: string;
  course: {
    name: string;
    location: string | null;
    schedule: string | null;
    trainer_id: string | null;
  } | null;
};

type SessionDb = {
  id: string;
  course_id: string;
  session_date: string;
  session_index: number;
  start_time: string | null;
  end_time: string | null;
  courses: (NonNullable<MySessionRow["course"]> & { archived_at: string | null }) | null;
};

type AttendanceDb = {
  session_id: string;
  course_sessions: {
    session_date: string;
    session_index: number;
    start_time: string | null;
    end_time: string | null;
    courses: { name: string } | null;
  } | null;
};

/** Vom Vorstand bestätigter Einsatz (für die Abrechnung). */
export type DoneRow = {
  sessionId: string;
  date: string;
  sessionIndex: number;
  startTime: string | null;
  endTime: string | null;
  courseName: string;
};

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export function weekdayLabel(date: string) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "";
}
export function timeLabel(r: { start_time: string | null; end_time: string | null }) {
  if (!r.start_time) return "";
  const a = r.start_time.slice(0, 5);
  return r.end_time ? `${a}–${r.end_time.slice(0, 5)} Uhr` : `${a} Uhr`;
}

/**
 * Eigene Einsätze und bestätigte Anwesenheiten der angemeldeten Trainer:in.
 * Genutzt von „Heute“ und „Ich“.
 */
export function useMySessions() {
  const [rows, setRows] = useState<MySessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState("");
  // Vom Vorstand bestätigte Anwesenheiten (Termin-ID → Datum), auch bei Ersatz-Einsätzen
  const [confirmed, setConfirmed] = useState<DoneRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      setMe(me ?? "");
      if (!me) {
        setLoading(false);
        return;
      }

      // Nur die eigenen Einsätze laden (nicht alle Termine des Vereins; Supabase liefert pro Abfrage höchstens
      // 1000 Zeilen). Wie unter „Meine Kurse“ zählen auch Kurse, in denen man als Kurstrainer:in eingetragen ist.
      const SELECT =
        "id,course_id,session_date,session_index,start_time,end_time,assigned_trainer_id,courses(name,location,schedule,trainer_id,archived_at)";
      const assignments = await fetchAll<{ session_id: string }>((f, t) =>
        supabase
          .from("course_session_assignments")
          .select("session_id")
          .eq("trainer_id", me)
          .order("id")
          .range(f, t),
      );
      const ownCourses = await fetchAll<{ id: string }>((f, t) =>
        supabase.from("courses").select("id").eq("trainer_id", me).order("id").range(f, t),
      );
      const [byAssignment, byTerm, byCourse] = await Promise.all([
        fetchIn<SessionDb>(
          assignments.map((a) => a.session_id),
          (chunk, f, t) =>
            supabase.from("course_sessions").select(SELECT).in("id", chunk).order("id").range(f, t),
        ),
        fetchAll<SessionDb>((f, t) =>
          supabase
            .from("course_sessions")
            .select(SELECT)
            .eq("assigned_trainer_id", me)
            .order("id")
            .range(f, t),
        ),
        fetchIn<SessionDb>(
          ownCourses.map((c) => c.id),
          (chunk, f, t) =>
            supabase
              .from("course_sessions")
              .select(SELECT)
              .in("course_id", chunk)
              .order("id")
              .range(f, t),
        ),
      ]);
      const att = await fetchAll<AttendanceDb>((f, t) =>
        supabase
          .from("trainer_session_attendance")
          .select(
            "id,session_id,course_sessions(session_date,session_index,start_time,end_time,courses(name))",
          )
          .eq("trainer_id", me)
          .eq("present", true)
          .not("confirmed_at", "is", null)
          .order("id")
          .range(f, t),
      );
      setConfirmed(
        // Auch Termine abgeschlossener (archivierter) Kurse: bestätigt heißt, der Einsatz hat stattgefunden
        att.flatMap(({ session_id, course_sessions: s }) =>
          s
            ? [
                {
                  sessionId: session_id,
                  date: s.session_date,
                  sessionIndex: s.session_index,
                  startTime: s.start_time ?? null,
                  endTime: s.end_time ?? null,
                  courseName: s.courses?.name ?? "Kurs",
                },
              ]
            : [],
        ),
      );
      const byId = new Map<string, SessionDb>();
      for (const s of [...byAssignment, ...byTerm, ...byCourse]) byId.set(s.id, s);
      // Abgesagte (archivierte) Kurse nicht anzeigen
      const mine = [...byId.values()]
        .filter((s) => !s.courses?.archived_at)
        .sort(
          (a, b) =>
            a.session_date.localeCompare(b.session_date) || a.session_index - b.session_index,
        );
      setRows(
        mine.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          session_index: s.session_index,
          start_time: s.start_time ?? null,
          end_time: s.end_time ?? null,
          courseId: s.course_id,
          course: s.courses ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const today = todayBerlinIso();
  const upcoming = useMemo(() => rows.filter((r) => r.session_date >= today), [rows, today]);
  return { rows, upcoming, confirmed, me, loading, today };
}
