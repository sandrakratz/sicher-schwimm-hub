import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExamCriteriaState } from "@/lib/swim-exams";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { findExamLevel } from "@/lib/swim-exams";

export type TrainerParticipant = {
  id: string;
  name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  /** Gesundheitsangaben aus der Anmeldung (Kursanfrage) – nur lesend. */
  health_info: string | null;
  paid: boolean;
  goal_reached: boolean | null;
  badge: string | null;
  achievement: string | null;
  exam_level: string | null;
  exam_criteria: ExamCriteriaState;
  exam_date: string | null;
  exam_pass_no: string | null;
  /** Klötzchen am Schwimmgurt (6 = Anfänger … 0 = ohne Gurt), null = nicht erfasst. */
  belt_blocks: number | null;
  /** Letzter erfasster Gurt-Stand desselben Kindes aus einem früheren Kurs. */
  prev_belt: PreviousBelt | null;
};

export type PreviousBelt = {
  blocks: number;
  course_name: string | null;
  /** Kursende bzw. -beginn des früheren Kurses (YYYY-MM-DD). */
  date: string | null;
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
    if (!roles.some((r) => ["admin", "board", "trainer"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = context.userId;
    const allowed = new Set<string>();

    const { data: ownCourses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("trainer_id", me);
    (ownCourses || []).forEach((c) => allowed.add(c.id as string));

    // Nur die eigenen Zuordnungen laden (nicht alle Termine des Vereins): Supabase liefert pro Abfrage höchstens
    // 1000 Zeilen, sonst würden eigene Kurse irgendwann nicht mehr erscheinen.
    const ownSessions = await fetchAll<{ course_id: string }>((f, t) =>
      supabaseAdmin
        .from("course_sessions")
        .select("course_id")
        .eq("assigned_trainer_id", me)
        .order("id")
        .range(f, t),
    );
    ownSessions.forEach((s) => allowed.add(s.course_id));

    const assignments = await fetchAll<{ session_id: string }>((f, t) =>
      supabaseAdmin
        .from("course_session_assignments")
        .select("session_id")
        .eq("trainer_id", me)
        .order("id")
        .range(f, t),
    );
    const assignedSessions = await fetchIn<{ course_id: string }>(
      assignments.map((a) => a.session_id),
      (chunk, f, t) =>
        supabaseAdmin
          .from("course_sessions")
          .select("course_id")
          .in("id", chunk)
          .order("id")
          .range(f, t),
    );
    assignedSessions.forEach((s) => allowed.add(s.course_id));

    if (allowed.size === 0) return [];
    const ids = Array.from(allowed);

    const courses = (
      await fetchIn<any>(ids, (chunk, f, t) =>
        supabaseAdmin
          .from("courses")
          .select("id,name,location,schedule,starts_on,ends_on")
          .in("id", chunk)
          .order("id")
          .range(f, t),
      )
    ).sort((x, y) => String(x.starts_on ?? "9999").localeCompare(String(y.starts_on ?? "9999")));

    const parts = await fetchIn<any>(ids, (chunk, f, t) =>
      supabaseAdmin
        .from("course_participants")
        .select(
          "id,course_id,request_id,participant_name,participant_email,participant_phone,date_of_birth,status,notes,paid,goal_reached,badge,achievement,exam_level,exam_criteria,exam_date,exam_pass_no,belt_blocks",
        )
        .in("course_id", chunk)
        .neq("status", "cancelled")
        .order("participant_name", { ascending: true })
        .order("id")
        .range(f, t),
    );

    // Gesundheitsangaben aus der Anmeldung: Trainer müssen sie beim Kind sehen, auch wenn sie bei der
    // Buchung nicht in den Hinweis des Kindes übernommen wurden.
    const requests = await fetchIn<{ id: string; health_info: string | null }>(
      parts.map((p) => p.request_id as string),
      (chunk, f, t) =>
        supabaseAdmin
          .from("course_requests")
          .select("id,health_info")
          .in("id", chunk)
          .order("id")
          .range(f, t),
    );
    const healthByRequest = new Map(requests.map((r) => [r.id, r.health_info]));

    // Gurt-Stand aus früheren Kursen desselben Kindes (Name + Geburtsdatum, wie bei der Dubletten-Prüfung).
    const beltHistory = await fetchIn<{
      course_id: string;
      participant_name: string | null;
      date_of_birth: string | null;
      belt_blocks: number;
      created_at: string | null;
      courses: { name: string | null; starts_on: string | null; ends_on: string | null } | null;
    }>(
      parts.map((p) => p.date_of_birth as string),
      (chunk, f, t) =>
        supabaseAdmin
          .from("course_participants")
          .select(
            "id,course_id,participant_name,date_of_birth,belt_blocks,created_at,courses!course_participants_course_id_fkey(name,starts_on,ends_on)",
          )
          .in("date_of_birth", chunk)
          .not("belt_blocks", "is", null)
          .order("id")
          .range(f, t),
    );
    const childKey = (name: unknown, dob: unknown) =>
      `${String(name ?? "")
        .trim()
        .toLowerCase()}|${String(dob ?? "")}`;
    type BeltRow = PreviousBelt & { courseId: string; startsOn: string | null };
    const historyByChild = new Map<string, BeltRow[]>();
    for (const h of beltHistory) {
      const course = h.courses;
      const key = childKey(h.participant_name, h.date_of_birth);
      const row: BeltRow = {
        blocks: Number(h.belt_blocks),
        course_name: course?.name ?? null,
        date:
          String(course?.ends_on ?? course?.starts_on ?? h.created_at ?? "").slice(0, 10) || null,
        courseId: h.course_id,
        startsOn: course?.starts_on ?? null,
      };
      historyByChild.set(key, [...(historyByChild.get(key) ?? []), row]);
    }
    /** Jüngster Stand aus einem anderen, nicht später beginnenden Kurs. */
    const prevFor = (
      p: { participant_name: unknown; date_of_birth: unknown },
      course: { id: string; starts_on: unknown },
    ): PreviousBelt | null => {
      const start = (course.starts_on ?? null) as string | null;
      const best = (historyByChild.get(childKey(p.participant_name, p.date_of_birth)) ?? [])
        .filter((h) => h.courseId !== course.id && !(start && h.startsOn && h.startsOn > start))
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
      return best ? { blocks: best.blocks, course_name: best.course_name, date: best.date } : null;
    };

    return courses.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      location: (c.location ?? null) as string | null,
      schedule: (c.schedule ?? null) as string | null,
      starts_on: (c.starts_on ?? null) as string | null,
      ends_on: (c.ends_on ?? null) as string | null,
      participants: parts
        .filter((p) => p.course_id === c.id)
        .map((p) => ({
          id: p.id as string,
          name: (p.participant_name ?? "") as string,
          date_of_birth: (p.date_of_birth ?? null) as string | null,
          email: (p.participant_email ?? null) as string | null,
          phone: (p.participant_phone ?? null) as string | null,
          status: p.status as string,
          notes: (p.notes ?? null) as string | null,
          health_info: (healthByRequest.get(p.request_id as string) ?? null) as string | null,
          paid: Boolean(p.paid),
          goal_reached: (p.goal_reached ?? null) as boolean | null,
          badge: (p.badge ?? null) as string | null,
          achievement: (p.achievement ?? null) as string | null,
          exam_level: (p.exam_level ?? null) as string | null,
          exam_criteria: (p.exam_criteria ?? {}) as ExamCriteriaState,
          exam_date: (p.exam_date ?? null) as string | null,
          exam_pass_no: (p.exam_pass_no ?? null) as string | null,
          belt_blocks: (p.belt_blocks ?? null) as number | null,
          prev_belt: prevFor(p, c),
        })),
    }));
  });

/**
 * Gurt-Stand (Klötzchen am Schwimmgurt, 6 … 0) eines Kindes setzen; `null` = nicht erfasst.
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des jeweiligen Kurses.
 */
export const updateParticipantBelt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string; blocks: number | null }) => {
    if (!input?.participantId) throw new Error("Teilnehmende:r fehlt.");
    if (
      input.blocks !== null &&
      !(Number.isInteger(input.blocks) && input.blocks >= 0 && input.blocks <= 6)
    ) {
      throw new Error("Die Zahl der Klötzchen muss zwischen 0 und 6 liegen.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<{ belt_blocks: number | null }> => {
    await assertCourseAccessForParticipant(context.supabase, context.userId, data.participantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("course_participants")
      .update({ belt_blocks: data.blocks })
      .eq("id", data.participantId);
    if (error) throw new Error(error.message);
    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "participant.belt_updated",
        entity: "course_participants",
        entity_id: data.participantId,
        metadata: { belt_blocks: data.blocks },
      });
    } catch {
      /* Audit-Fehler dürfen die Erfassung nicht blockieren */
    }
    return { belt_blocks: data.blocks };
  });

/** Wichtigen Hinweis zum Kind (Gesundheit, Besonderheiten) bearbeiten – Trainer des Kurses + Vorstand. */
export const updateParticipantHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string; hint: string }) => {
    if (typeof input?.hint !== "string" || input.hint.length > 2000)
      throw new Error("Hinweis zu lang");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ hint: string | null }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some((r) => ["admin", "board"].includes(r));
    if (!isStaff && !roles.includes("trainer")) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!p) throw new Error("Teilnehmende:r nicht gefunden.");
    if (!isStaff) {
      const { data: allowed } = await context.supabase.rpc("is_trainer_of_course", {
        _trainer_id: context.userId,
        _course_id: p.course_id as string,
      });
      if (!allowed) throw new Response("Forbidden", { status: 403 });
    }
    const value = data.hint.trim() || null;
    const { error } = await supabaseAdmin
      .from("course_participants")
      .update({ notes: value })
      .eq("id", p.id as string);
    if (error) throw new Error(error.message);
    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "participant.hint_updated",
        entity: "course_participants",
        entity_id: p.id as string,
      });
    } catch {
      /* ignore */
    }
    return { hint: value };
  });

/**
 * Telefonnummer der Eltern für eine:n Teilnehmende:n nacherfassen/korrigieren.
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des jeweiligen Kurses.
 * Die Nummer wird zusätzlich in die zugehörige Kursanfrage übernommen.
 */
export const updateParticipantPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string; phone: string }) => {
    if (typeof input?.participantId !== "string" || !input.participantId)
      throw new Error("Teilnehmende:r fehlt.");
    if (typeof input.phone !== "string" || input.phone.length > 40)
      throw new Error("Bitte eine gültige Telefonnummer eingeben.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ phone: string | null }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some((r) => ["admin", "board"].includes(r));
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
        // Die Nummer selbst gehört nicht ins Protokoll (Datensparsamkeit)
        metadata: {
          course_id: participant.course_id,
          request_id: participant.request_id,
          phone_set: value !== null,
        },
      });
    } catch {
      /* Audit-Fehler dürfen die Erfassung nicht blockieren */
    }

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
      const text = (v: unknown, max: number, label: string) => {
        if (v == null || v === "") return;
        if (typeof v !== "string" || v.length > max)
          throw new Error(`${label} ist zu lang oder ungültig.`);
      };
      if (typeof input.badge !== "string" || typeof input.achievement !== "string")
        throw new Error("Abzeichen und Anmerkung fehlen.");
      text(input.badge, 100, "Abzeichen");
      text(input.achievement, 2000, "Die Anmerkung");
      text(input.examPassNo, 40, "Die Schwimmpass-Nr.");
      if (input.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.examDate))
        throw new Error("Ungültiges Prüfungsdatum.");
      if (input.examLevel && !findExamLevel(input.examLevel))
        throw new Error("Unbekannte Prüfungsstufe.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some((r) => ["admin", "board"].includes(r));
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
      // Bisherigen Stand laden, damit Datum und Prüfer:in je Teilprüfung erhalten bleiben.
      const { data: prevRow } = await supabaseAdmin
        .from("course_participants")
        .select("exam_criteria")
        .eq("id", data.participantId)
        .maybeSingle();
      const prev = ((prevRow?.exam_criteria ?? {}) as ExamCriteriaState) || {};
      const { data: me } = await supabaseAdmin
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", context.userId)
        .maybeSingle();
      const myName =
        [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() ||
        me?.email ||
        "Unbekannt";
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
        new Date(),
      );
      const isIso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      for (const c of level.criteria) {
        const entry = data.examCriteria?.[c.key];
        if (!entry) continue;
        const value = typeof entry.value === "string" ? entry.value.trim().slice(0, 40) : null;
        const total = typeof entry.total === "string" ? entry.total.trim().slice(0, 40) : null;
        if (!(entry.done || value || total)) continue;
        const old = prev[c.key];
        const done = Boolean(entry.done);
        const wasDone = old?.done === true;
        criteria[c.key] = {
          done,
          value: value || null,
          total: total || null,
          date: done
            ? isIso(entry.date)
              ? entry.date!
              : isIso(old?.date)
                ? old!.date!
                : today
            : null,
          by_id: done ? (wasDone && old?.by_id ? old.by_id : context.userId) : null,
          by_name: done ? (wasDone && old?.by_name ? old.by_name : myName) : null,
        };
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
          criteria_done: Object.values(criteria).filter((c) => c.done).length,
        },
      });
    } catch {
      /* Audit-Fehler dürfen die Erfassung nicht blockieren */
    }

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
    const isStaff = roles.some((r) => ["admin", "board"].includes(r));
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
      .select(
        "participant_name,date_of_birth,exam_level,exam_criteria,exam_date,exam_pass_no,goal_reached,badge,achievement,belt_blocks,status",
      )
      .eq("course_id", data.courseId)
      .neq("status", "cancelled")
      .order("participant_name", { ascending: true });

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", context.userId)
      .maybeSingle();
    void me;
    const examinerName =
      "Michael Kratz, staatl. gepr. Fachkraft für Bäderbetriebe (Reg.-Nr. 88-5169, Regierungspräsident Düsseldorf)";

    const { renderExamProtocolPdf } = await import("@/lib/exam-protocol-pdf.server");
    const bytes = await renderExamProtocolPdf({
      courseName: (course.name ?? "") as string,
      location: (course.location ?? null) as string | null,
      schedule: (course.schedule ?? null) as string | null,
      startsOn: (course.starts_on ?? null) as string | null,
      endsOn: (course.ends_on ?? null) as string | null,
      examinerName,
      participants: (parts || []).map((p) => ({
        name: (p.participant_name ?? "") as string,
        dateOfBirth: (p.date_of_birth ?? null) as string | null,
        examLevel: (p.exam_level ?? null) as string | null,
        criteria: (p.exam_criteria ?? {}) as ExamCriteriaState,
        examDate: (p.exam_date ?? null) as string | null,
        passNo: (p.exam_pass_no ?? null) as string | null,
        goalReached: (p.goal_reached ?? null) as boolean | null,
        badge: (p.badge ?? null) as string | null,
        achievement: (p.achievement ?? null) as string | null,
        beltBlocks: (p.belt_blocks ?? null) as number | null,
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
    } catch {
      /* Audit-Fehler dürfen den Export nicht blockieren */
    }

    return { filename, base64: Buffer.from(bytes).toString("base64") };
  });

async function assertCourseAccessForParticipant(
  supabase: any,
  userId: string,
  participantId: string,
): Promise<void> {
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows || []).map((r: { role: string }) => r.role);
  if (roles.some((r: string) => ["admin", "board"].includes(r))) return;
  if (!roles.includes("trainer")) throw new Response("Forbidden", { status: 403 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("course_participants")
    .select("course_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!p) throw new Error("Teilnehmer nicht gefunden.");
  const { data: allowed } = await supabase.rpc("is_trainer_of_course", {
    _trainer_id: userId,
    _course_id: p.course_id,
  });
  if (!allowed) throw new Response("Forbidden", { status: 403 });
}

/** Teilleistungsnachweis (DPO) eines Kindes als PDF herunterladen. */
export const exportPartialCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => {
    if (!input?.participantId) throw new Error("Teilnehmer fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ filename: string; base64: string }> => {
    await assertCourseAccessForParticipant(context.supabase, context.userId, data.participantId);
    const { buildPartialCertificate } = await import("@/lib/partial-certificate-pdf.server");
    const { berlinToday } = await import("@/lib/partial-certificate.server");
    const cert = await buildPartialCertificate(data.participantId, berlinToday());
    if (!cert)
      throw new Error(
        "Kein Teilleistungsnachweis möglich: Es sind keine oder bereits alle Prüfungsteile bestanden.",
      );
    return { filename: cert.filename, base64: Buffer.from(cert.bytes).toString("base64") };
  });

/** Teilleistungsnachweis sofort per E-Mail an die Eltern schicken (manuell). */
export const sendPartialCertificateNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => {
    if (!input?.participantId) throw new Error("Teilnehmer fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ status: string }> => {
    await assertCourseAccessForParticipant(context.supabase, context.userId, data.participantId);
    const { sendPartialCertificate } = await import("@/lib/partial-certificate.server");
    const status = await sendPartialCertificate(data.participantId, {
      force: true,
      senderUserId: context.userId,
    });
    return { status };
  });

/** Eltern: Teilleistungsnachweis des eigenen Kindes herunterladen. */
export const exportMyPartialCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => {
    if (!input?.participantId) throw new Error("Teilnehmer fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ filename: string; base64: string }> => {
    const { data: p } = await context.supabase
      .from("course_participants")
      .select("id,parent_user_id,user_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!p || (p.parent_user_id !== context.userId && p.user_id !== context.userId)) {
      throw new Response("Forbidden", { status: 403 });
    }
    const { buildPartialCertificate } = await import("@/lib/partial-certificate-pdf.server");
    const { berlinToday } = await import("@/lib/partial-certificate.server");
    const cert = await buildPartialCertificate(data.participantId, berlinToday());
    if (!cert) throw new Error("Für dieses Kind liegt kein Teilleistungsnachweis vor.");
    return { filename: cert.filename, base64: Buffer.from(cert.bytes).toString("base64") };
  });

/** Eltern: Kursbestätigung (Rechnung) des eigenen Kindes herunterladen. */
export const exportMyCourseConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => {
    if (!input?.participantId) throw new Error("Teilnehmer fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ filename: string; base64: string }> => {
    const { data: p } = await context.supabase
      .from("course_participants")
      .select(
        "id,parent_user_id,user_id,status,participant_name,payer_street,payer_zip,payer_city,price_amount,document_no,document_issued_at,created_at,request_id,course_id",
      )
      .eq("id", data.participantId)
      .maybeSingle();
    if (!p || (p.parent_user_id !== context.userId && p.user_id !== context.userId)) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (p.status !== "confirmed") throw new Error("Nur für verbindliche Buchungen verfügbar.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select(
        "name,location,starts_on,ends_on,schedule,unit_count,payment_due_days,course_programs(name,location)",
      )
      .eq("id", p.course_id)
      .maybeSingle();
    if (!course) throw new Error("Kurs nicht gefunden");
    const program = (course as any).course_programs as {
      name: string;
      location: string | null;
    } | null;
    let payerName = p.participant_name;
    if (p.request_id) {
      const { data: r } = await supabaseAdmin
        .from("course_requests")
        .select("parent_name")
        .eq("id", p.request_id)
        .maybeSingle();
      if (r?.parent_name) payerName = r.parent_name;
    }
    const { renderConfirmationPdf } = await import("@/lib/course-confirmation-pdf.server");
    const bytes = await renderConfirmationPdf({
      documentNo: p.document_no,
      issuedAt: p.document_issued_at || p.created_at,
      payerName,
      payerStreet: p.payer_street,
      payerZip: p.payer_zip,
      payerCity: p.payer_city,
      childName: p.participant_name,
      courseName: course.name,
      programName: program?.name ?? null,
      startsOn: course.starts_on,
      endsOn: course.ends_on,
      schedule: course.schedule,
      location: course.location ?? program?.location ?? null,
      unitCount: course.unit_count,
      priceAmount: p.price_amount != null ? Number(p.price_amount) : null,
      paymentDueDays: course.payment_due_days ?? 14,
    } as any);
    const safe = (s: string) => s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 60);
    return {
      filename: `Kursbestaetigung_${safe(p.participant_name || "Kind")}_${safe(course.name)}.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
