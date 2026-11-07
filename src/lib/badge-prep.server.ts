/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase-Abfragen mit Einbettungen */
// Server-only: Abzeichen-Stand eines Kurses laden.
import { fetchAll } from "@/lib/fetch-all";
import { buildBadgePrep, type BadgePrep } from "@/lib/badge-prep";

export type CourseBadgePrep = BadgePrep & {
  course: {
    id: string;
    name: string;
    location: string | null;
    last_session: string | null;
  };
};

/** Letzter Kurstag = letzter Termin, sonst Kursende. */
export function lastSessionDate(
  sessionDates: Array<string | null | undefined>,
  endsOn: string | null | undefined,
): string | null {
  const dates = sessionDates.filter((d): d is string => !!d).sort();
  return dates.length ? dates[dates.length - 1] : (endsOn ?? null);
}

export async function loadCourseBadgePrep(courseId: string): Promise<CourseBadgePrep | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: course } = await db
    .from("courses")
    .select("id,name,location,ends_on,course_sessions(session_date)")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return null;

  const parts = await fetchAll<any>((f, t) =>
    db
      .from("course_participants")
      .select("id,participant_name,date_of_birth,badge,goal_reached,exam_level,exam_criteria,exam_date")
      .eq("course_id", courseId)
      .neq("status", "cancelled")
      .order("id")
      .range(f, t),
  );

  const prep = buildBadgePrep(
    parts.map((p) => ({
      id: p.id,
      name: p.participant_name,
      date_of_birth: p.date_of_birth,
      badge: p.badge,
      goal_reached: p.goal_reached,
      exam_level: p.exam_level,
      exam_criteria: p.exam_criteria,
      exam_date: p.exam_date,
    })),
  );

  return {
    ...prep,
    course: {
      id: course.id,
      name: course.name,
      location: course.location ?? null,
      last_session: lastSessionDate(
        ((course.course_sessions ?? []) as Array<{ session_date: string }>).map((s) => s.session_date),
        course.ends_on,
      ),
    },
  };
}
