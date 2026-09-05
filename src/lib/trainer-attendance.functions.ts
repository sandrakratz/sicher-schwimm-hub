import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrainerAttendanceRow = {
  session_id: string;
  trainer_id: string;
  trainer_name: string;
  present: boolean;
  note: string | null;
  recorded_at: string;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
};

export type TrainerSessionRow = {
  id: string;
  session_index: number;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
};

async function displayNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,first_name,last_name,email")
    .in("id", unique);
  (data || []).forEach((p: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => {
    map.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "—");
  });
  return map;
}

async function rolesOf(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data || []) as { role: string }[]).map(r => r.role);
}

/** Termine eines Kurses inkl. Trainer-Anwesenheitseinträgen. */
export const listCourseTrainerAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => {
    if (!d || typeof d.courseId !== "string" || d.courseId.length < 8) throw new Error("courseId required");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ sessions: TrainerSessionRow[]; rows: TrainerAttendanceRow[]; isStaff: boolean }> => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some(r => ["admin", "board", "trainer"].includes(r))) throw new Error("Forbidden");
    const isStaff = roles.some(r => ["admin", "board"].includes(r));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sessions } = await supabaseAdmin
      .from("course_sessions")
      .select("id,session_index,session_date,start_time,end_time")
      .eq("course_id", data.courseId)
      .order("session_index", { ascending: true });
    const list = (sessions || []) as TrainerSessionRow[];
    if (list.length === 0) return { sessions: [], rows: [], isStaff };

    const { data: att } = await supabaseAdmin
      .from("trainer_session_attendance")
      .select("session_id,trainer_id,present,note,recorded_at,confirmed_at,confirmed_by")
      .in("session_id", list.map(s => s.id));

    const names = await displayNames([
      ...(att || []).map((a: any) => a.trainer_id as string),
      ...(att || []).map((a: any) => a.confirmed_by as string).filter(Boolean),
    ]);

    const rows: TrainerAttendanceRow[] = (att || []).map((a: any) => ({
      session_id: a.session_id,
      trainer_id: a.trainer_id,
      trainer_name: names.get(a.trainer_id) || "—",
      present: !!a.present,
      note: a.note ?? null,
      recorded_at: a.recorded_at,
      confirmed_at: a.confirmed_at ?? null,
      confirmed_by_name: a.confirmed_by ? names.get(a.confirmed_by) || null : null,
    }));

    return { sessions: list, rows, isStaff };
  });

/** Trainer:in trägt die eigene Anwesenheit ein (nur solange unbestätigt). */
export const setOwnTrainerAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string; present: boolean | null; note?: string | null }) => {
    if (!d || typeof d.sessionId !== "string" || d.sessionId.length < 8) throw new Error("sessionId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some(r => ["admin", "board", "trainer"].includes(r))) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("trainer_session_attendance")
      .select("id,confirmed_at")
      .eq("session_id", data.sessionId)
      .eq("trainer_id", context.userId)
      .maybeSingle();

    if (existing?.confirmed_at) {
      throw new Error("Der Eintrag wurde bereits vom Vorstand bestätigt und kann nicht mehr geändert werden.");
    }

    if (data.present === null) {
      if (existing) {
        const { error } = await supabaseAdmin.from("trainer_session_attendance").delete().eq("id", existing.id);
        if (error) throw error;
      }
    } else if (existing) {
      const { error } = await supabaseAdmin
        .from("trainer_session_attendance")
        .update({ present: data.present, note: data.note?.trim() || null, recorded_at: new Date().toISOString(), recorded_by: context.userId })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("trainer_session_attendance").insert({
        session_id: data.sessionId,
        trainer_id: context.userId,
        present: data.present,
        note: data.note?.trim() || null,
        recorded_by: context.userId,
      });
      if (error) throw error;
    }

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "trainer_attendance_recorded",
        entity: "course_sessions",
        entity_id: data.sessionId,
        metadata: { present: data.present },
      });
    } catch (err) {
      console.warn("[trainer-attendance] Nicht-kritischer Fehler:", err);
    }

    return { ok: true };
  });

/** Vorstand bestätigt Einträge eines Termins (oder hebt die Bestätigung auf). */
export const confirmTrainerAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string; trainerId?: string | null; confirm: boolean }) => {
    if (!d || typeof d.sessionId !== "string" || d.sessionId.length < 8) throw new Error("sessionId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some(r => ["admin", "board"].includes(r))) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("trainer_session_attendance")
      .update(
        data.confirm
          ? { confirmed_at: new Date().toISOString(), confirmed_by: context.userId }
          : { confirmed_at: null, confirmed_by: null },
      )
      .eq("session_id", data.sessionId);
    if (data.trainerId) q = q.eq("trainer_id", data.trainerId);
    const { error } = await q;
    if (error) throw error;

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: data.confirm ? "trainer_attendance_confirmed" : "trainer_attendance_unconfirmed",
        entity: "course_sessions",
        entity_id: data.sessionId,
        metadata: { trainer_id: data.trainerId || null },
      });
    } catch (err) {
      console.warn("[trainer-attendance] Nicht-kritischer Fehler:", err);
    }

    return { ok: true };
  });

/** Anzahl noch nicht bestätigter Trainer-Einträge (für Adminhinweis). */
export const countUnconfirmedTrainerAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some(r => ["admin", "board"].includes(r))) return 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("trainer_session_attendance")
      .select("id", { count: "exact", head: true })
      .is("confirmed_at", null);
    return count || 0;
  });
