import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CalendarPerson = { id: string; name: string };

export type CalendarEntry = {
  kind: "session" | "event";
  id: string;
  date: string; // YYYY-MM-DD (Europe/Berlin)
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  title: string;
  subtitle: string | null;
  location: string | null;
  trainers: CalendarPerson[];
  helpers: string[];
  helperNeed: { name: string; needed: number; filled: number }[];
  courseId?: string;
  eventId?: string;
};

function hhmm(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function berlinParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const s = fmt.format(d); // "2026-08-31 20:15"
  const [date, time] = s.split(" ");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
}

/** Alle Kurstermine und Vereinstermine als Kalenderliste (Verwaltung). */
export const listAdminCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalendarEntry[]> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    if (!roles.some((r) => ["admin", "board"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sessions }, { data: courses }, { data: profiles }, { data: assigns }, { data: events }, { data: groups }, { data: signups }] =
      await Promise.all([
        supabaseAdmin
          .from("course_sessions")
          .select("id,course_id,session_index,session_date,start_time,end_time,note,assigned_trainer_id")
          .order("session_date", { ascending: true }),
        supabaseAdmin.from("courses").select("id,name,location,schedule,trainer_id,archived_at"),
        supabaseAdmin.from("profiles").select("id,first_name,last_name,email"),
        supabaseAdmin.from("course_session_assignments").select("session_id,trainer_id"),
        supabaseAdmin.from("events").select("id,title,location,starts_at,ends_at,signup_enabled"),
        supabaseAdmin.from("event_helper_groups").select("id,event_id,name,needed_count,starts_at,ends_at"),
        supabaseAdmin
          .from("event_shift_signups")
          .select("event_id,group_id,trainer_id,helper_name,available,starts_at,ends_at"),
      ]);

    const nameOf = new Map<string, string>();
    (profiles || []).forEach((p) => {
      const n = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      nameOf.set(p.id as string, n || (p.email as string) || "Unbekannt");
    });

    const courseById = new Map<string, (typeof courses extends (infer T)[] ? T : never)>();
    (courses || []).forEach((c) => courseById.set(c.id as string, c as never));

    const perSession = new Map<string, Set<string>>();
    (assigns || []).forEach((a) => {
      const set = perSession.get(a.session_id as string) ?? new Set<string>();
      set.add(a.trainer_id as string);
      perSession.set(a.session_id as string, set);
    });

    const entries: CalendarEntry[] = [];

    (sessions || []).forEach((s) => {
      const c = courseById.get(s.course_id as string) as
        | { name: string; location: string | null; schedule: string | null; trainer_id: string | null; archived_at: string | null }
        | undefined;
      if (!c || c.archived_at) return;
      const trainerIds = new Set<string>(perSession.get(s.id as string) ?? []);
      if (s.assigned_trainer_id) trainerIds.add(s.assigned_trainer_id as string);
      if (c.trainer_id) trainerIds.add(c.trainer_id);
      entries.push({
        kind: "session",
        id: s.id as string,
        date: s.session_date as string,
        startTime: hhmm(s.start_time as string | null),
        endTime: hhmm(s.end_time as string | null),
        title: c.name,
        subtitle: `${s.session_index}. Termin${s.note ? ` · ${s.note}` : ""}${
          !s.start_time && c.schedule ? ` · ${c.schedule}` : ""
        }`,
        location: c.location ?? null,
        trainers: [...trainerIds].map((id) => ({ id, name: nameOf.get(id) ?? "Unbekannt" })),
        helpers: [],
        helperNeed: [],
        courseId: s.course_id as string,
      });
    });

    (events || []).forEach((e) => {
      const start = berlinParts(e.starts_at as string);
      const end = e.ends_at ? berlinParts(e.ends_at as string) : null;
      const evGroups = (groups || []).filter((g) => g.event_id === e.id);
      const evSignups = (signups || []).filter((s) => s.event_id === e.id && s.available !== false);
      const helperNames = evSignups.map(
        (s) => (s.helper_name as string | null) || nameOf.get(s.trainer_id as string) || "Helfer:in",
      );
      entries.push({
        kind: "event",
        id: e.id as string,
        date: start.date,
        startTime: start.time || null,
        endTime: end && end.date === start.date ? end.time : null,
        title: e.title as string,
        subtitle: e.signup_enabled ? "Helfer-Umfrage aktiv" : null,
        location: (e.location as string | null) ?? null,
        trainers: [],
        helpers: [...new Set(helperNames)],
        helperNeed: evGroups.map((g) => ({
          name: g.name as string,
          needed: (g.needed_count as number) ?? 0,
          filled: evSignups.filter((s) => s.group_id === g.id).length,
        })),
        eventId: e.id as string,
      });
    });

    entries.sort((a, b) =>
      a.date === b.date
        ? (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")
        : a.date.localeCompare(b.date),
    );
    return entries;
  });
