import { askConfirm } from "@/components/admin/confirm-store";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import type { Course, CourseCounts, ProgramRow } from "@/components/admin/kurse/shared";

export const EMPTY_COUNTS: CourseCounts = {
  confirmed: 0,
  waiting: 0,
  unpaid: 0,
  overdue: 0,
  sessions: 0,
  staffed: 0,
};

/** Kurs hat begonnen (oder ist archiviert): erst dann gibt es die Steuerliste. */
export function hasStarted(c: Course) {
  if (c.archived_at) return true;
  if (!c.starts_on) return false;
  return c.starts_on <= todayBerlinIso();
}

/** Belegung, offene Zahlungen, Angebote und Dienstplan-Besetzung je Kurs. */
async function loadCounts(list: Course[]): Promise<Record<string, CourseCounts>> {
  const map: Record<string, CourseCounts> = {};
  const of = (courseId: string) => (map[courseId] ??= { ...EMPTY_COUNTS });

  const parts = await fetchAll<{
    course_id: string;
    status: string;
    paid: boolean;
    payment_due_date: string | null;
  }>((f, t) =>
    supabase
      .from("course_participants")
      .select("course_id,status,paid,payment_due_date")
      .order("id")
      .range(f, t),
  );
  const today = todayBerlinIso();
  for (const p of parts) {
    const m = of(p.course_id);
    if (p.status === "confirmed") {
      m.confirmed++;
      if (!p.paid) {
        m.unpaid++;
        if (p.payment_due_date && p.payment_due_date < today) m.overdue++;
      }
    } else if (p.status === "waiting") m.waiting++;
  }

  const courseIds = list.map((c) => c.id);
  if (!courseIds.length) return map;

  const offers = await fetchIn<{ offer_course_id: string | null; offer_expires_at: string | null }>(
    courseIds,
    (chunk, f, t) =>
      supabase
        .from("waitlist_entries")
        .select("offer_course_id,offer_expires_at")
        .eq("status", "offered")
        .in("offer_course_id", chunk)
        .order("id")
        .range(f, t),
  );
  const nowIso = new Date().toISOString();
  for (const o of offers) {
    if (!o.offer_course_id || (o.offer_expires_at && o.offer_expires_at < nowIso)) continue;
    const m = of(o.offer_course_id);
    m.offered = (m.offered ?? 0) + 1;
  }

  const sessList = await fetchIn<{
    id: string;
    course_id: string;
    assigned_trainer_id: string | null;
  }>(courseIds, (chunk, f, t) =>
    supabase
      .from("course_sessions")
      .select("id,course_id,assigned_trainer_id")
      .in("course_id", chunk)
      .order("id")
      .range(f, t),
  );
  const asgRows = await fetchIn<{ session_id: string; trainer_id: string }>(
    sessList.map((s) => s.id),
    (chunk, f, t) =>
      supabase
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", chunk)
        .order("id")
        .range(f, t),
  );
  const assigned = new Map<string, Set<string>>();
  for (const a of asgRows) {
    const set = assigned.get(a.session_id) ?? new Set<string>();
    set.add(a.trainer_id);
    assigned.set(a.session_id, set);
  }
  const needed = new Map(list.map((c) => [c.id, c.trainers_needed ?? 2] as const));
  for (const s of sessList) {
    const m = of(s.course_id);
    m.sessions++;
    const team = new Set(assigned.get(s.id) ?? []);
    if (s.assigned_trainer_id) team.add(s.assigned_trainer_id);
    if (team.size >= (needed.get(s.course_id) ?? 2)) m.staffed++;
  }
  return map;
}

/** Familien auf der Anfrageliste (Status wartend) je Programm, für die Anzeige in der Kursliste. */
async function loadWaitingByProgram(): Promise<Record<string, number>> {
  try {
    const waiting = await fetchAll<{ id: string; program_id: string | null }>((f, t) =>
      supabase
        .from("waitlist_entries")
        .select("id,program_id")
        .eq("status", "waiting")
        .order("id")
        .range(f, t),
    );
    const byProgram: Record<string, number> = {};
    for (const w of waiting)
      if (w.program_id) byProgram[w.program_id] = (byProgram[w.program_id] ?? 0) + 1;
    return byProgram;
  } catch {
    return {};
  }
}

/** Kurse, Kursangebote und Kennzahlen der Kursverwaltung samt Archivieren/Löschen. */
export function useCourseData() {
  const [rows, setRows] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [counts, setCounts] = useState<Record<string, CourseCounts>>({});
  const [waitingByProgram, setWaitingByProgram] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    // Alle Abfragen seitenweise/in Blöcken: Supabase liefert sonst höchstens 1000 Zeilen und rechnet still mit zu wenigen Daten.
    const list = await fetchAll<Course>((f, t) =>
      supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(f, t),
    );
    setRows(list);
    setCounts(await loadCounts(list));
    setWaitingByProgram(await loadWaitingByProgram());
    const { data: progs } = await supabase
      .from("course_programs")
      .select("*")
      .order("sort_order", { ascending: true });
    // Interne Kurse ans Ende; Array.sort ist stabil, die Reihenfolge nach sort_order bleibt sonst erhalten.
    setPrograms(
      [...((progs as ProgramRow[]) || [])].sort(
        (a, b) => Number(a.is_public === false) - Number(b.is_public === false),
      ),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Wartende Familien der Anfrageliste, die für ein Programm (inkl. Mischkurse) in Frage kommen. */
  const waitingFor = (programId: string | null) =>
    relatedProgramIds(programId, programs).reduce(
      (sum, id) => sum + (waitingByProgram[id] ?? 0),
      0,
    );

  const termsOf = (programId: string | null) =>
    rows.filter((r) => (programId === null ? !r.program_id : r.program_id === programId));

  async function removeCourse(c: Course) {
    // Buchungen (inkl. Rechnungsnummern und Zahlungen) hängen am Kurs und müssen aufbewahrt werden:
    // ein Kurs mit Einträgen wird nur archiviert, nie gelöscht.
    const { count, error: cntErr } = await supabase
      .from("course_participants")
      .select("id", { count: "exact", head: true })
      .eq("course_id", c.id);
    if (cntErr) return toast.error(`Löschen nicht möglich: ${cntErr.message}`);
    if ((count ?? 0) > 0) {
      return toast.error(
        `„${c.name}“ hat ${count} Buchung(en) und kann nicht gelöscht werden. Bitte stattdessen archivieren.`,
        { duration: 8000 },
      );
    }
    if (
      !(await askConfirm({
        title: "Kurs löschen?",
        consequence: `Der Kurs „${c.name}“ hat keine Buchungen und wird endgültig gelöscht. Es geht keine Mail raus. Du kannst ihn nicht wiederherstellen, nur neu anlegen.`,
        confirmLabel: "Endgültig löschen",
        destructive: true,
      }))
    )
      return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error)
      return toast.error(
        error.message.includes("Buchungen")
          ? "Kurs hat Buchungen und kann nicht gelöscht werden. Bitte archivieren."
          : error.message,
      );
    toast.success("Gelöscht");
    await load();
  }

  async function setArchived(c: Course, archived: boolean) {
    if (
      archived &&
      !(await askConfirm({
        title: "Kurs archivieren?",
        consequence: `Der Kurs „${c.name}“ verschwindet aus der normalen Liste und ist nicht mehr buchbar. Es geht keine Mail raus. Du kannst ihn jederzeit wiederherstellen.`,
        confirmLabel: "Archivieren",
      }))
    )
      return;
    const { error } = await supabase
      .from("courses")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(archived ? "Kurs archiviert" : "Kurs wiederhergestellt");
    await load();
  }

  return {
    rows,
    programs,
    counts,
    load,
    waitingFor,
    termsOf,
    removeCourse,
    setArchived,
  };
}
