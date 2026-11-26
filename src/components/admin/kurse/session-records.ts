import { supabase } from "@/integrations/supabase/client";

/**
 * Termine, zu denen schon Anwesenheit (Kinder oder Trainer:innen) erfasst ist. Solche Termine dürfen
 * nicht gelöscht oder per Terminliste ersetzt werden: Die Anwesenheit ist Nachweis für den
 * Versicherungsschutz (Aufbewahrung 2 Jahre) und Grundlage der Übungsleiter-Abrechnung.
 * Die Datenbank löscht beides sonst kaskadierend mit.
 */
export async function sessionsWithAttendance(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const [kids, trainers] = await Promise.all([
    supabase.from("course_attendance").select("session_id").in("session_id", sessionIds),
    supabase.from("trainer_session_attendance").select("session_id").in("session_id", sessionIds),
  ]);
  if (kids.error) throw new Error(kids.error.message);
  if (trainers.error) throw new Error(trainers.error.message);
  return new Set([...(kids.data ?? []), ...(trainers.data ?? [])].map((r) => r.session_id));
}

/** Gleiches für alle Termine eines Kurszeitraums (Terminliste ersetzen). */
export async function courseHasAttendance(courseId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("course_sessions")
    .select("id")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((s) => s.id);
  return (await sessionsWithAttendance(ids)).size > 0;
}

export const REPLACE_LOCK_TEXT =
  "Zu diesem Kurszeitraum ist schon Anwesenheit erfasst. Die Terminliste lässt sich deshalb nicht mehr komplett ersetzen – einzelne künftige Termine bitte unter „Termine“ ändern oder ergänzen.";

export const ATTENDANCE_LOCK_TEXT =
  "Zu diesem Termin ist schon Anwesenheit erfasst. Sie ist Nachweis für den Versicherungsschutz und die Übungsleiter-Abrechnung und darf deshalb nicht gelöscht werden.";
