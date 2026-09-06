import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrainerParticipant = {
  id: string;
  name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  paid: boolean;
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
      .select("id,course_id,participant_name,participant_email,participant_phone,date_of_birth,status,notes,paid")
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
      .select("id,course_id,request_id,participant_name")
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

    if (participant.request_id) {
      await supabaseAdmin
        .from("course_requests")
        .update({ parent_phone: value })
        .eq("id", participant.request_id as string);
    }

    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        actorId: context.userId,
        action: "participant.phone_updated",
        entity: "course_participants",
        entityId: participant.id as string,
        metadata: { course_id: participant.course_id, request_id: participant.request_id, phone: value },
      });
    } catch { /* Audit-Fehler dürfen die Erfassung nicht blockieren */ }

    return { phone: value };
  });
