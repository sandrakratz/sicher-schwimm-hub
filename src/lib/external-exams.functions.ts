import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findExamLevel, mergeCriteria, type ExamCriteriaState } from "@/lib/swim-exams";
import { todayBerlinIso } from "@/lib/format";
import type { ExternalExam } from "@/lib/external-exams.server";

export type { ExternalExam } from "@/lib/external-exams.server";

export type ExternalExamDay = {
  /** Kurse, die an diesem Tag laufen und in denen die Person abnehmen darf. */
  courses: Array<{ id: string; name: string; location: string | null }>;
  entries: ExternalExam[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function forbid(): never {
  throw new Response("Forbidden", { status: 403 });
}

/** Abnahmen eines Tages und die Kurse, an die sie angehängt werden können. */
export const listExternalExamDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examDate: string }) => {
    if (!ISO.test(input?.examDate ?? "")) throw new Error("Ungültiges Datum.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ExternalExamDay> => {
    const { callerAccess, mayUseCourse, externalExamsTable, EXTERNAL_EXAM_COLUMNS } =
      await import("@/lib/external-exams.server");
    const access = await callerAccess(context.supabase, context.userId);
    if (!access.isStaff && !access.isTrainer) forbid();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: courseRows, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id,name,location")
      .lte("starts_on", data.examDate)
      .or(`ends_on.is.null,ends_on.gte.${data.examDate}`)
      .order("name");
    if (cErr) throw new Error(cErr.message);
    const allowed = await Promise.all(
      (courseRows ?? []).map((c) => mayUseCourse(context.supabase, context.userId, access, c.id)),
    );
    const courses = (courseRows ?? [])
      .filter((_, i) => allowed[i])
      .map((c) => ({
        id: c.id as string,
        name: c.name as string,
        location: c.location as string | null,
      }));

    const { data: rows, error } = await externalExamsTable()
      .select(EXTERNAL_EXAM_COLUMNS)
      .eq("exam_date", data.examDate)
      .order("person_name");
    if (error) throw new Error(error.message);
    const courseIds = new Set(courses.map((c) => c.id));
    const entries = ((rows ?? []) as ExternalExam[]).filter(
      (r) =>
        access.isStaff ||
        r.recorded_by === context.userId ||
        (r.course_id != null && courseIds.has(r.course_id)),
    );
    return { courses, entries };
  });

type SaveInput = {
  id?: string | null;
  examDate: string;
  courseId?: string | null;
  location?: string | null;
  personName: string;
  dateOfBirth: string;
  origin?: string | null;
  examLevel?: string | null;
  examCriteria?: ExamCriteriaState;
  examPassNo?: string | null;
  goalReached: boolean | null;
  badge: string;
  achievement: string;
};

/** Externe Abnahme anlegen oder ändern. */
export const saveExternalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveInput) => {
    const text = (v: unknown, max: number, label: string) => {
      if (v == null || v === "") return;
      if (typeof v !== "string" || v.length > max)
        throw new Error(`${label} ist zu lang oder ungültig.`);
    };
    if (!ISO.test(input?.examDate ?? "")) throw new Error("Ungültiges Prüfungsdatum.");
    if (!input.personName?.trim()) throw new Error("Name erforderlich.");
    if (!ISO.test(input.dateOfBirth ?? "")) throw new Error("Geburtsdatum erforderlich.");
    if (input.goalReached !== null && typeof input.goalReached !== "boolean")
      throw new Error("Ungültiges Gesamtergebnis.");
    text(input.personName, 120, "Der Name");
    text(input.origin, 120, "Die Herkunft");
    text(input.location, 120, "Der Ort");
    text(input.badge, 100, "Das Abzeichen");
    text(input.achievement, 2000, "Die Anmerkung");
    text(input.examPassNo, 40, "Die Schwimmpass-Nr.");
    if (input.examLevel && !findExamLevel(input.examLevel))
      throw new Error("Unbekannte Prüfungsstufe.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ExternalExam> => {
    const { callerAccess, mayUseCourse, externalExamsTable, EXTERNAL_EXAM_COLUMNS } =
      await import("@/lib/external-exams.server");
    const access = await callerAccess(context.supabase, context.userId);
    if (!access.isStaff && !access.isTrainer) forbid();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let location = data.location?.trim() || null;
    const courseId = data.courseId || null;
    if (courseId) {
      if (!(await mayUseCourse(context.supabase, context.userId, access, courseId))) forbid();
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("location")
        .eq("id", courseId)
        .maybeSingle();
      if (!course) throw new Error("Kurs nicht gefunden.");
      location = (course.location as string | null) ?? location;
    }

    let previous: ExamCriteriaState = {};
    if (data.id) {
      const { data: old, error } = await externalExamsTable()
        .select("id,course_id,recorded_by,exam_criteria")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!old) throw new Error("Eintrag nicht gefunden.");
      const ownsCourse =
        old.course_id != null &&
        (await mayUseCourse(context.supabase, context.userId, access, old.course_id));
      if (!access.isStaff && old.recorded_by !== context.userId && !ownsCourse) forbid();
      previous = (old.exam_criteria ?? {}) as ExamCriteriaState;
    }

    const examLevel = data.examLevel?.trim() || null;
    const { displayNameOf } = await import("@/lib/exam-examiner.server");
    const criteria = mergeCriteria({
      levelKey: examLevel,
      input: data.examCriteria,
      previous,
      userId: context.userId,
      userName: examLevel ? await displayNameOf(context.userId) : "",
      today: todayBerlinIso(),
    });

    const row = {
      exam_date: data.examDate,
      course_id: courseId,
      location,
      person_name: data.personName.trim(),
      date_of_birth: data.dateOfBirth,
      origin: data.origin?.trim() || null,
      exam_level: examLevel,
      exam_criteria: criteria,
      exam_pass_no: data.examPassNo?.trim() || null,
      goal_reached: data.goalReached,
      badge: data.badge.trim() || null,
      achievement: data.achievement.trim() || null,
      recorded_by: context.userId,
      recorded_at: new Date().toISOString(),
    };
    const query = data.id
      ? externalExamsTable().update(row).eq("id", data.id)
      : externalExamsTable().insert(row);
    const { data: saved, error: saveErr } = await query.select(EXTERNAL_EXAM_COLUMNS).single();
    if (saveErr) throw new Error(saveErr.message);

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: data.id ? "external_exam.updated" : "external_exam.created",
        entity: "external_badge_exams",
        entity_id: (saved as ExternalExam).id,
        metadata: {
          exam_date: data.examDate,
          course_id: courseId,
          exam_level: examLevel,
          goal_reached: data.goalReached,
          criteria_done: Object.values(criteria).filter((c) => c.done).length,
        },
      });
    } catch {
      /* Audit-Fehler dürfen die Erfassung nicht blockieren */
    }
    return saved as ExternalExam;
  });

/** Externe Abnahme löschen (Vorstand/Verwaltung, die erfassende Person oder Trainer:in des Kurses). */
export const deleteExternalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Eintrag fehlt.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { callerAccess, mayUseCourse, externalExamsTable } =
      await import("@/lib/external-exams.server");
    const access = await callerAccess(context.supabase, context.userId);
    if (!access.isStaff && !access.isTrainer) forbid();
    const { data: old, error } = await externalExamsTable()
      .select("id,course_id,recorded_by")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!old) return { ok: true as const };
    const ownsCourse =
      old.course_id != null &&
      (await mayUseCourse(context.supabase, context.userId, access, old.course_id));
    if (!access.isStaff && old.recorded_by !== context.userId && !ownsCourse) forbid();
    const { error: delErr } = await externalExamsTable().delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "external_exam.deleted",
        entity: "external_badge_exams",
        entity_id: data.id,
        metadata: {},
      });
    } catch {
      /* Audit-Fehler dürfen das Löschen nicht blockieren */
    }
    return { ok: true as const };
  });

/**
 * Prüfungsprotokoll für einen Abnahmetermin ohne Kurs (alle externen Abnahmen eines Tages und Orts,
 * die an keinem Kurs hängen). Abnahmen, die an einen Kurs gehängt sind, stehen im Kursprotokoll.
 */
export const exportExternalExamProtocol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examDate: string; location?: string | null }) => {
    if (!ISO.test(input?.examDate ?? "")) throw new Error("Ungültiges Datum.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ filename: string; base64: string }> => {
    const { callerAccess, externalExamsTable, EXTERNAL_EXAM_COLUMNS, toProtocolParticipant } =
      await import("@/lib/external-exams.server");
    const access = await callerAccess(context.supabase, context.userId);
    if (!access.isStaff && !access.isTrainer) forbid();

    const location = data.location?.trim() || null;
    let q = externalExamsTable()
      .select(EXTERNAL_EXAM_COLUMNS)
      .eq("exam_date", data.examDate)
      .is("course_id", null)
      .order("person_name");
    q = location ? q.eq("location", location) : q.is("location", null);
    if (!access.isStaff) q = q.eq("recorded_by", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Für diesen Abnahmetermin sind keine Abnahmen erfasst.");

    const { EXAMINER_NAME, EXAMINER_TITLE } = await import("@/lib/partial-certificate-pdf.server");
    const { renderExamProtocolPdf } = await import("@/lib/exam-protocol-pdf.server");
    const bytes = await renderExamProtocolPdf({
      courseName: "Abzeichen-Abnahme (ohne Kurs)",
      location,
      schedule: null,
      startsOn: data.examDate,
      endsOn: data.examDate,
      examinerName: `${EXAMINER_NAME}, ${EXAMINER_TITLE}`,
      participants: (rows as ExternalExam[]).map(toProtocolParticipant),
    });

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "exam_protocol_exported",
        entity: "external_badge_exams",
        entity_id: null,
        metadata: { exam_date: data.examDate, participants: rows.length },
      });
    } catch {
      /* Audit-Fehler dürfen den Export nicht blockieren */
    }
    return {
      filename: `Pruefungsprotokoll_Abnahme_${data.examDate}.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
