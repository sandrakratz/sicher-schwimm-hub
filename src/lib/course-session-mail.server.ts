// Termine eines Kurses für Mails (Terminliste und Kalenderlink in Bestätigung/Zuteilung).
import { parseTimeRange } from "@/lib/ics";

const SITE_BASE_URL = "https://sicher-schwimmen.com";

export type MailSessionRow = { date: string; start: string | null; end: string | null };

/**
 * Alle Termine des Kurses, aufsteigend. Fehlen Uhrzeiten am Termin, werden sie – wie im Trainerkalender –
 * aus dem Zeitplan des Kurses gelesen. Gibt eine leere Liste zurück, wenn noch keine Termine angelegt sind.
 */
export async function loadCourseSessionsForMail(
  courseId: string,
  schedule?: string | null,
): Promise<MailSessionRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("course_sessions")
    .select("session_date,start_time,end_time")
    .eq("course_id", courseId)
    .order("session_date", { ascending: true })
    .order("session_index", { ascending: true });
  if (error || !data) return [];
  const fallback = parseTimeRange(schedule ?? null);
  return data.map((s: any) => ({
    date: s.session_date as string,
    start: s.start_time ? String(s.start_time).slice(0, 5) : (fallback?.start ?? null),
    end: s.end_time ? String(s.end_time).slice(0, 5) : (fallback?.end ?? null),
  }));
}

export function courseIcsUrl(courseId: string): string {
  return `${SITE_BASE_URL}/api/public/course-ics?course=${encodeURIComponent(courseId)}`;
}
