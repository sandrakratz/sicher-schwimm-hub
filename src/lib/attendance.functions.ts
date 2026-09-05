import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AttendanceStatus = "present" | "excused" | "absent";

export type AttendanceSession = {
  id: string;
  session_index: number;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
};

export type AttendanceRecord = {
  session_id: string;
  participant_id: string;
  status: AttendanceStatus;
  note: string | null;
  updated_at: string;
  recorded_by_name: string | null;
};

export type CourseAttendance = {
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
};

async function assertCourseAccess(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
  courseId: string,
): Promise<void> {
  const isStaff = (await supabase.rpc("is_staff", { _user_id: userId })).data;
  if (isStaff) return;
  const isTrainer = (await supabase.rpc("is_trainer_of_course", {
    _trainer_id: userId,
    _course_id: courseId,
  })).data;
  if (!isTrainer) throw new Error("Forbidden");
}

export const listCourseAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => {
    if (!d || typeof d.courseId !== "string" || d.courseId.length < 8) {
      throw new Error("courseId required");
    }
    return d;
  })
  .handler(async ({ data, context }): Promise<CourseAttendance> => {
    const { supabase, userId } = context;
    await assertCourseAccess(supabase as never, userId, data.courseId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessRows } = await supabaseAdmin
      .from("course_sessions")
      .select("id,session_index,session_date,start_time,end_time")
      .eq("course_id", data.courseId)
      .order("session_index", { ascending: true });
    const sessions = (sessRows || []).map(s => ({
      id: s.id as string,
      session_index: s.session_index as number,
      session_date: s.session_date as string,
      start_time: (s.start_time ?? null) as string | null,
      end_time: (s.end_time ?? null) as string | null,
    }));

    if (sessions.length === 0) return { sessions, records: [] };

    const { data: attRows } = await supabaseAdmin
      .from("course_attendance")
      .select("session_id,participant_id,status,note,updated_at,recorded_by")
      .in("session_id", sessions.map(s => s.id));

    const recorderIds = Array.from(
      new Set((attRows || []).map(r => r.recorded_by as string | null).filter(Boolean) as string[]),
    );
    const nameById = new Map<string, string>();
    if (recorderIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", recorderIds);
      (profs || []).forEach(p => {
        const name =
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || (p.email as string) || "";
        nameById.set(p.id as string, name);
      });
    }

    return {
      sessions,
      records: (attRows || []).map(r => ({
        session_id: r.session_id as string,
        participant_id: r.participant_id as string,
        status: r.status as AttendanceStatus,
        note: (r.note ?? null) as string | null,
        updated_at: r.updated_at as string,
        recorded_by_name: r.recorded_by ? nameById.get(r.recorded_by as string) ?? null : null,
      })),
    };
  });

export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      sessionId: string;
      participantId: string;
      status: AttendanceStatus | null;
      note?: string | null;
    }) => {
      if (!d || typeof d.sessionId !== "string" || typeof d.participantId !== "string") {
        throw new Error("sessionId und participantId erforderlich");
      }
      if (d.status !== null && !["present", "excused", "absent"].includes(d.status)) {
        throw new Error("Ungültiger Status");
      }
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("course_sessions")
      .select("id,course_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Kurstermin nicht gefunden");

    await assertCourseAccess(supabase as never, userId, session.course_id as string);

    const { data: part } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!part || part.course_id !== session.course_id) {
      throw new Error("Teilnehmer gehört nicht zu diesem Kurs");
    }

    if (data.status === null) {
      const { error } = await supabaseAdmin
        .from("course_attendance")
        .delete()
        .eq("session_id", data.sessionId)
        .eq("participant_id", data.participantId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("course_attendance")
        .upsert(
          {
            session_id: data.sessionId,
            participant_id: data.participantId,
            status: data.status,
            note: data.note?.trim() ? data.note.trim() : null,
            recorded_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id,participant_id" },
        );
      if (error) throw error;
    }

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, userId, {
        action: "attendance_recorded",
        entity: "course_sessions",
        entity_id: data.sessionId,
        metadata: { participant_id: data.participantId, status: data.status },
      });
    } catch (err) {
      console.warn("[attendance] Nicht-kritischer Fehler:", err);
    }

    return { ok: true };
  });
