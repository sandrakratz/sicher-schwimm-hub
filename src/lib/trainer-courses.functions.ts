import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExamCriteriaState } from "@/lib/swim-exams";

export type TrainerParticipant = {
  id: string;
  name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  paid: boolean;
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
  exam_level: string | null;
  exam_criteria: ExamCriteriaState;
  exam_date: string | null;
  exam_pass_no: string | null;
};

export type TrainerCourse = {
  id: string;
  name: string;
  location: string | null;
  schedule: string | null;
  starts_on: string | null;
  ends_on: string | null;
  participants: TrainerParticipant[];
};

/**
 * Kurse, in denen die angemeldete Person als Trainer:in eingeteilt ist,
 * inkl. Teilnehmerdaten. Zahlungsdetails werden bewusst auf das
 * Kennzeichen "bezahlt" reduziert.
 */
export const listMyTrainerCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerCourse[]> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    if (!roles.some(r => ["admin", "board", "trainer"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = context.userId;
    const allowed = new Set<string>();

    const { data: ownCourses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("trainer_id", me);
    (ownCourses || []).forEach(c => allowed.add(c.id as string));

    const { data: sessions } = await supabaseAdmin
      .from("course_sessions")
      .select("id,course_id,assigned_trainer_id");
    const sessionCourse = new Map<string, string>();
    (sessions || []).forEach(s => {
      sessionCourse.set(s.id as string, s.course_id as string);
      if (s.assigned_trainer_id === me) allowed.add(s.course_id as string);
    });

    const { data: assignments } = await supabaseAdmin
      .from("course_session_assignments")
      .select("session_id")
      .eq("trainer_id", me);
    (assignments || []).forEach(a => {
      const cid = sessionCourse.get(a.session_id as string);
      if (cid) allowed.add(cid);
    });

    if (allowed.size === 0) return [];
    const ids = Array.from(allowed);

    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id,name,location,schedule,starts_on,ends_on")
      .in("id", ids)
      .order("starts_on", { ascending: true });

    const { data: parts } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id,participant_name,participant_email,participant_phone,date_of_birth,status,notes,paid,goal_reached,badge,achievement,exam_level,exam_criteria,exam_date,exam_pass_no")
      .in("course_id", ids)
      .neq("status", "cancelled")
      .order("participant_name", { ascending: true });

    return (courses || []).map(c => ({
      id: c.id as string,
      name: c.name as string,
      location: (c.location ?? null) as string | null,
      schedule: (c.schedule ?? null) as string | null,
      starts_on: (c.starts_on ?? null) as string | null,
      ends_on: (c.ends_on ?? null) as string | null,
      participants: (parts || [])
        .filter(p => p.course_id === c.id)
        .map(p => ({
          id: p.id as string,
          name: (p.participant_name ?? "") as string,
          date_of_birth: (p.date_of_birth ?? null) as string | null,
          email: (p.participant_email ?? null) as string | null,
          phone: (p.participant_phone ?? null) as string | null,
          status: p.status as string,
          notes: (p.notes ?? null) as string | null,
          paid: Boolean(p.paid),
          goal_reached: (p.goal_reached ?? null) as boolean | null,
          badge: (p.badge ?? null) as string | null,
          achievement: (p.achievement ?? null) as string | null,
          exam_level: (p.exam_level ?? null) as string | null,
          exam_criteria: ((p.exam_criteria ?? {}) as ExamCriteriaState),
          exam_date: (p.exam_date ?? null) as string | null,
          exam_pass_no: (p.exam_pass_no ?? null) as string | null,
        })),
    }));
  });

/**
 * Telefonnummer der Eltern für eine:n Teilnehmende:n nacherfassen/korrigieren.
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des jeweiligen Kurses.
 * Die Nummer wird zusätzlich in die zugehörige Kursanfrage übernommen.
 */
export const updateParticipantPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string; phone: string }) => input)
  .handler(async ({ data, context }): Promise<{ phone: string | null }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some(r => ["admin", "board"].includes(r));
    if (!isStaff && !roles.includes("trainer")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const phone = data.phone.trim();
    if (phone.length > 0 && !/^[+0-9 ()/.-]{5,32}$/.test(phone)) {
      throw new Error("Bitte eine gültige Telefonnummer eingeben.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participant, error: pErr } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id,request_id,participant_name,parent_user_id,user_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!participant) throw new Error("Teilnehmende:r nicht gefunden.");

    if (!isStaff) {
      const { data: allowed } = await context.supabase.rpc("is_trainer_of_course", {
        _trainer_id: context.userId,
        _course_id: participant.course_id as string,
      });
      if (!allowed) throw new Response("Forbidden", { status: 403 });
    }

    const value = phone.length > 0 ? phone : null;

    const { error: upErr } = await supabaseAdmin
      .from("course_participants")
      .update({ participant_phone: value })
      .eq("id", participant.id as string);
    if (upErr) throw new Error(upErr.message);

    // Die Nummer nur an einer Stelle pflegen: zugehörige Anfrage, Wartelisteneintrag
    // und (falls noch leer) das Benutzerprofil werden mitgeführt.
    if (participant.request_id) {
      await supabaseAdmin
        .from("course_requests")
        .update({ parent_phone: value })
        .eq("id", participant.request_id as string);
      await supabaseAdmin
        .from("waitlist_entries")
        .update({ parent_phone: value })
        .eq("request_id", participant.request_id as string);
    }

    const profileId = (participant.parent_user_id ?? participant.user_id) as string | null;
    if (profileId && value) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("id", profileId)
        .maybeSingle();
      if (prof && !prof.phone) {
        await supabaseAdmin.from("profiles").update({ phone: value }).eq("id", profileId);
      }
    }

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "participant.phone_updated",
        entity: "course_participants",
        entity_id: participant.id as string,
        metadata: { course_id: participant.course_id, request_id: participant.request_id, phone: value },
      });
    } catch { /* Audit-Fehler dürfen die Erfassung nicht blockieren */ }

    return { phone: value };
  });

/**
 * Kursergebnis und Prüfungsnachweis (Abzeichen, Teilleistungen nach DPO,
 * Prüfungsdatum, Schwimmpass-Nr.) durch Trainer:innen vor Ort erfassen.
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des jeweiligen Kurses.
 */
export const updateParticipantResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      participantId: string;
      goalReached: boolean | null;
      badge: string;
      achievement: string;
      examLevel?: string | null;
      examCriteria?: ExamCriteriaState;
      examDate?: string | null;
      examPassNo?: string | null;
    }) => {
      if (!input?.participantId) throw new Error("Teilnehmende:r fehlt.");
      if (input.goalReached !== null && typeof input.goalReached !== "boolean") {
        throw new Error("Ungültige Angabe zum Kursziel.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some(r => ["admin", "board"].includes(r));
    if (!isStaff && !roles.includes("trainer")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participant, error: pErr } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!participant) throw new Error("Teilnehmende:r nicht gefunden.");

    if (!isStaff) {
      const { data: allowed } = await context.supabase.rpc("is_trainer_of_course", {
        _trainer_id: context.userId,
        _course_id: participant.course_id as string,
      });
      if (!allowed) throw new Response("Forbidden", { status: 403 });
    }

    const badge = data.badge.trim() || null;
    const achievement = data.achievement.trim() || null;
    const examLevel = (data.examLevel || "").trim() || null;
    const examDate = (data.examDate || "").trim() || null;
    const examPassNo = (data.examPassNo || "").trim() || null;

    // Nur bekannte Prüfungsteile speichern – keine Fremddaten übernehmen.
    const { findExamLevel } = await import("@/lib/swim-exams");
    const level = findExamLevel(examLevel);
    const criteria: ExamCriteriaState = {};
    if (level) {
      for (const c of level.criteria) {
        const entry = data.examCriteria?.[c.key];
        if (!entry) continue;
        const value = typeof entry.value === "string" ? entry.value.trim().slice(0, 40) : null;
        const total = typeof entry.total === "string" ? entry.total.trim().slice(0, 40) : null;
        if (entry.done || value || total) {
          criteria[c.key] = { done: Boolean(entry.done), value: value || null, total: total || null };
        }
      }
    }

    const { error: upErr } = await supabaseAdmin
      .from("course_participants")
      .update({
        goal_reached: data.goalReached,
        badge,
        achievement,
        exam_level: examLevel,
        exam_criteria: criteria,
        exam_date: examDate,
        exam_pass_no: examPassNo,
        exam_recorded_by: context.userId,
        exam_recorded_at: new Date().toISOString(),
      })
      .eq("id", participant.id as string);
    if (upErr) throw new Error(upErr.message);

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "participant.result_updated",
        entity: "course_participants",
        entity_id: participant.id as string,
        metadata: {
          course_id: participant.course_id,
          goal_reached: data.goalReached,
          badge,
          achievement,
          exam_level: examLevel,
          exam_date: examDate,
          exam_pass_no: examPassNo,
          criteria_done: Object.values(criteria).filter(c => c.done).length,
        },
      });
    } catch { /* Audit-Fehler dürfen die Erfassung nicht blockieren */ }

    return {
      goal_reached: data.goalReached,
      badge,
      achievement,
      exam_level: examLevel,
      exam_criteria: criteria,
      exam_date: examDate,
      exam_pass_no: examPassNo,
    };
  });

/**
 * Prüfungsprotokoll nach DPO für einen Kurs als PDF (Vereinsakte).
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des Kurses.
 */
export const exportExamProtocol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => {
    if (!input?.courseId) throw new Error("Kurs fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ filename: string; base64: string }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some(r => ["admin", "board"].includes(r));
    if (!isStaff && !roles.includes("trainer")) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (!isStaff) {
      const { data: allowed } = await context.supabase.rpc("is_trainer_of_course", {
        _trainer_id: context.userId,
        _course_id: data.courseId,
      });
      if (!allowed) throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id,name,location,schedule,starts_on,ends_on")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) throw new Error("Kurs nicht gefunden.");

    const { data: parts } = await supabaseAdmin
      .from("course_participants")
      .select("participant_name,date_of_birth,exam_level,exam_criteria,exam_date,exam_pass_no,goal_reached,badge,achievement,status")
      .eq("course_id", data.courseId)
      .neq("status", "cancelled")
      .order("participant_name", { ascending: true });

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", context.userId)
      .maybeSingle();
    const examinerName = [me?.first_name, me?.last_name].filter(Boolean).join(" ") || "—";

    const { renderExamProtocolPdf } = await import("@/lib/exam-protocol-pdf.server");
    const bytes = await renderExamProtocolPdf({
      courseName: (course.name ?? "") as string,
      location: (course.location ?? null) as string | null,
      schedule: (course.schedule ?? null) as string | null,
      startsOn: (course.starts_on ?? null) as string | null,
      endsOn: (course.ends_on ?? null) as string | null,
      examinerName,
      participants: (parts || []).map(p => ({
        name: (p.participant_name ?? "") as string,
        dateOfBirth: (p.date_of_birth ?? null) as string | null,
        examLevel: (p.exam_level ?? null) as string | null,
        criteria: ((p.exam_criteria ?? {}) as ExamCriteriaState),
        examDate: (p.exam_date ?? null) as string | null,
        passNo: (p.exam_pass_no ?? null) as string | null,
        goalReached: (p.goal_reached ?? null) as boolean | null,
        badge: (p.badge ?? null) as string | null,
        achievement: (p.achievement ?? null) as string | null,
      })),
    });

    const safe = (s: string) => s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    const filename = `Pruefungsprotokoll_${safe((course.name ?? "Kurs") as string)}.pdf`;

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "exam_protocol_exported",
        entity: "courses",
        entity_id: data.courseId,
        metadata: { participants: (parts || []).length },
      });
    } catch { /* Audit-Fehler dürfen den Export nicht blockieren */ }

    return { filename, base64: Buffer.from(bytes).toString("base64") };
  });
