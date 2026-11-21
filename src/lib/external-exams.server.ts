// Server-only: Zugriff auf Abzeichen-Abnahmen ohne Kursbuchung (Tabelle external_badge_exams).
// Die Tabelle fehlt in types.ts, daher der Cast.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ExamCriteriaState } from "@/lib/swim-exams";
import type { ExamProtocolParticipant } from "@/lib/exam-protocol-pdf.server";

export type ExternalExam = {
  id: string;
  exam_date: string;
  course_id: string | null;
  location: string | null;
  person_name: string;
  date_of_birth: string;
  origin: string | null;
  exam_level: string | null;
  exam_criteria: ExamCriteriaState;
  exam_pass_no: string | null;
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
  recorded_by: string | null;
};

export const EXTERNAL_EXAM_COLUMNS =
  "id,exam_date,course_id,location,person_name,date_of_birth,origin,exam_level,exam_criteria,exam_pass_no,goal_reached,badge,achievement,recorded_by";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const externalExamsTable = () => (supabaseAdmin as any).from("external_badge_exams");

export type CallerAccess = { isStaff: boolean; isTrainer: boolean };

export async function callerAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<CallerAccess> {
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows || []).map((r: { role: string }) => r.role);
  return {
    isStaff: roles.some((r: string) => ["admin", "board"].includes(r)),
    isTrainer: roles.includes("trainer"),
  };
}

/** Ob die Person Trainer:in des Kurses ist (Vorstand/Verwaltung zählt immer). */
export async function mayUseCourse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  access: CallerAccess,
  courseId: string,
): Promise<boolean> {
  if (access.isStaff) return true;
  const { data } = await supabase.rpc("is_trainer_of_course", {
    _trainer_id: userId,
    _course_id: courseId,
  });
  return Boolean(data);
}

export function toProtocolParticipant(r: ExternalExam): ExamProtocolParticipant {
  return {
    name: r.person_name,
    dateOfBirth: r.date_of_birth,
    examLevel: r.exam_level,
    criteria: (r.exam_criteria ?? {}) as ExamCriteriaState,
    examDate: r.exam_date,
    passNo: r.exam_pass_no,
    goalReached: r.goal_reached,
    badge: r.badge,
    achievement: r.achievement,
    beltBlocks: null,
    external: { origin: r.origin },
  };
}
