import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addDaysIso, errorText, formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { parseSessionList } from "@/lib/session-list";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import { type Course } from "@/components/admin/kurse/shared";
import type { SessionRow, SessionsDialog } from "@/components/admin/kurse/SessionsDialog";
import {
  ATTENDANCE_LOCK_TEXT,
  REPLACE_LOCK_TEXT,
  sessionsWithAttendance,
} from "@/components/admin/kurse/session-records";

type Availability = { session_id: string; trainer_id: string; available: boolean };
type Assignment = { session_id: string; trainer_id: string };

/**
 * Zustand und Aktionen des Termin-Dialogs. `onCourseChanged` lädt die Kursliste neu,
 * nachdem Kursbeginn/-ende den Terminen angepasst wurden.
 */
export function useSessions(onCourseChanged: () => Promise<void>) {
  const trainersFn = useServerFn(listTrainers);
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function openSessions(c: Course) {
    setCourse(c);
    setOpen(true);
    const { data } = await supabase
      .from("course_sessions")
      .select("id,session_index,session_date,start_time,end_time,assigned_trainer_id")
      .eq("course_id", c.id)
      .order("session_index", { ascending: true });
    const list = (data as SessionRow[]) || [];
    setSessions(list);
    if (list.length > 0) {
      const ids = list.map((r) => r.id);
      const { data: av } = await supabase
        .from("course_session_availability")
        .select("session_id,trainer_id,available")
        .in("session_id", ids);
      setAvailability((av as Availability[]) || []);
      const { data: asg } = await supabase
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", ids);
      setAssignments((asg as Assignment[]) || []);
    } else {
      setAvailability([]);
      setAssignments([]);
    }
    if (trainers.length === 0) {
      try {
        setTrainers(await trainersFn());
      } catch {
        /* optional */
      }
    }
  }

  /** Kursbeginn/-ende folgen den Terminen (Zahlungsfristen und Erinnerungen hängen am Kursstart). */
  async function syncCourseDates(courseId: string) {
    const { data } = await supabase
      .from("course_sessions")
      .select("session_date")
      .eq("course_id", courseId)
      .order("session_date", { ascending: true });
    const dates = ((data as { session_date: string }[]) || []).map((d) => d.session_date);
    if (dates.length === 0) return;
    const { error } = await supabase
      .from("courses")
      .update({ starts_on: dates[0], ends_on: dates[dates.length - 1] })
      .eq("id", courseId);
    if (error) {
      toast.error(`Kursbeginn/-ende konnten nicht angepasst werden: ${error.message}`);
      return;
    }
    await onCourseChanged();
  }

  /** Nach Änderungen am Datum: Kurszeitraum anpassen und Termine neu laden. */
  async function resync() {
    if (!course) return;
    await syncCourseDates(course.id);
    await openSessions(course);
  }

  async function importSessions() {
    if (!course) return;
    const parsed = parseSessionList(bulkText);
    const real = parsed.filter((p) => !p.isBreak);
    if (real.length === 0)
      return toast.error("Keine Termine erkannt. Format z. B.: 07.11.2026 11:00–11:45 Uhr");
    try {
      if ((await sessionsWithAttendance(sessions.map((x) => x.id))).size > 0)
        return void toast.error(REPLACE_LOCK_TEXT, { duration: 10000 });
    } catch (e) {
      return void toast.error(errorText(e, "Anwesenheit konnte nicht geprüft werden"));
    }
    if (
      sessions.length > 0 &&
      !window.confirm(
        `Die ${sessions.length} vorhandenen Termine (inkl. Anwesenheit und Trainer-Einteilung) werden durch ${real.length} neue ersetzt. Fortfahren?`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      if (sessions.length > 0) {
        const { error } = await supabase
          .from("course_sessions")
          .delete()
          .eq("course_id", course.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("course_sessions").insert(
        real.map((p, i) => ({
          course_id: course.id,
          session_index: i + 1,
          session_date: p.date,
          start_time: p.start,
          end_time: p.end,
        })),
      );
      if (error) throw error;
      const breaks = parsed
        .filter((p) => p.isBreak)
        .map((p) => ({ date: p.date, note: p.note || "kein Termin" }));
      const { error: e2 } = await supabase
        .from("courses")
        .update({
          session_breaks: breaks,
          starts_on: real[0].date,
          ends_on: real[real.length - 1].date,
        })
        .eq("id", course.id);
      if (e2) throw e2;
      toast.success(
        `${real.length} Termine${breaks.length ? ` und ${breaks.length} Pausen` : ""} übernommen`,
      );
      setBulkText("");
      await openSessions(course);
    } catch (e) {
      toast.error(errorText(e, "Übernahme fehlgeschlagen"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function addSession() {
    if (!course) return;
    if (sessions.length >= 30) return toast.error("Maximal 30 Termine");
    const nextIndex = sessions.reduce((m, s) => Math.max(m, s.session_index), 0) + 1;
    const last = sessions[sessions.length - 1];
    // Vorschlag: eine Woche nach dem letzten Termin (sonst heute), anschließend im Dialog anpassen
    const proposed = last ? addDaysIso(last.session_date, 7) : todayBerlinIso();
    const { error } = await supabase.from("course_sessions").insert({
      course_id: course.id,
      session_index: nextIndex,
      session_date: proposed,
      start_time: last?.start_time ?? null,
      end_time: last?.end_time ?? null,
    });
    if (error) return toast.error(error.message);
    await resync();
  }

  async function updateSessionDate(id: string, date: string) {
    if (!date) return; // Feld wurde geleert: nichts speichern
    const { error } = await supabase
      .from("course_sessions")
      .update({ session_date: date })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await resync();
  }

  async function updateSessionTime(id: string, field: "start_time" | "end_time", value: string) {
    const next = value ? `${value}:00` : null;
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, [field]: next } : s)));
    const patch = field === "start_time" ? { start_time: next } : { end_time: next };
    const { error } = await supabase.from("course_sessions").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function removeSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    try {
      if ((await sessionsWithAttendance([id])).has(id))
        return void toast.error(ATTENDANCE_LOCK_TEXT, { duration: 10000 });
    } catch (e) {
      return void toast.error(errorText(e, "Anwesenheit konnte nicht geprüft werden"));
    }
    if (
      !window.confirm(
        `${s ? `Termin ${s.session_index} (${formatDateBerlin(s.session_date)})` : "Diesen Termin"} löschen?\n\nDas passiert: Der Termin und die Trainer-Einteilung dafür verschwinden. Die Eltern werden NICHT informiert – dafür danach „Eilnachricht an Eltern“ nutzen.`,
      )
    )
      return;
    const { error } = await supabase.from("course_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await resync();
  }

  const dialogProps: Parameters<typeof SessionsDialog>[0] = {
    open,
    onOpenChange: setOpen,
    course,
    sessions,
    availability,
    assignments,
    trainers,
    bulkText,
    setBulkText,
    bulkBusy,
    onImport: importSessions,
    onAdd: addSession,
    onRemove: removeSession,
    onDateChange: updateSessionDate,
    onTimeChange: updateSessionTime,
  };

  return { openSessions, dialogProps };
}
