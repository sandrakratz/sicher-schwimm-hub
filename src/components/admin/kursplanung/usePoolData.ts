import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Course, ProgramRow } from "@/components/admin/kurse/shared";
import { supabase } from "@/integrations/supabase/client";
import type { PlanBlackout } from "@/lib/dienstplan";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";
import type { TakenSession } from "@/lib/pool-schedule";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import { hhmm, toMin, toStored, type Crew, type PoolConfig, type StoredSlot } from "./utils";

// Tabellen der Kursplanung fehlen teils noch in types.ts.
const db = supabase as any;

type Avail = { d: string; t: string; ok: boolean };
type Pref = { trainerId: string; programId: string; pref: "gern" | "nein" };
type Waiting = { program: string; from: string | null };

/** Lädt alles, was die Kursplanung für ein Bad braucht: Kurse, Badtermine, belegte Termine, Trainer, Warteliste. */
export function usePoolData(cfg: PoolConfig) {
  const pool = cfg.id;
  const today = todayBerlinIso();
  const trainersFn = useServerFn(listTrainers);

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [slots, setSlots] = useState<StoredSlot[]>([]);
  /** Datei, aus der zuletzt Termine übernommen wurden. */
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [taken, setTaken] = useState<Record<string, TakenSession[]>>({});
  const [crewOn, setCrewOn] = useState<Record<string, Crew[]>>({});
  const [team, setTeam] = useState<TrainerOption[]>([]);
  const [availRows, setAvailRows] = useState<Avail[]>([]);
  // Grundsätzliche Bereitschaft der Trainer je Kursart (leer, solange die Migration fehlt)
  const [prefRows, setPrefRows] = useState<Pref[]>([]);
  const [blackouts, setBlackouts] = useState<PlanBlackout[]>([]);
  const [waiting, setWaiting] = useState<Waiting[] | null>(null);

  const loadBase = useCallback(async () => {
    try {
      // Beide zusammen setzen, damit die Standard-Kursarten nicht ohne Kurse berechnet werden.
      const [p, c] = await Promise.all([
        fetchAll<ProgramRow>((f, t) =>
          supabase.from("course_programs").select("*").order("sort_order").order("id").range(f, t),
        ),
        fetchAll<Course>((f, t) =>
          supabase.from("courses").select("*").is("archived_at", null).order("id").range(f, t),
        ),
      ]);
      setPrograms(p);
      setCourses(c);
    } catch (e: any) {
      toast.error(`Kurse konnten nicht geladen werden: ${e?.message ?? e}`);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("pool_slots")
      .select("*")
      .eq("pool", pool)
      .order("slot_date");
    setLoading(false);
    if (error)
      return toast.error(`Nutzungstermine konnten nicht geladen werden (${error.message}).`);
    const rows = data ?? [];
    setSlots(rows.map(toStored));
    const last = [...rows].sort((a, b) =>
      (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""),
    )[0];
    setSourceFile(last?.source_file ?? null);
  }, [pool]);

  /** Termine bereits angelegter Kurse am Wochentag dieses Bades. */
  const loadTaken = useCallback(async () => {
    try {
      const rows = await fetchAll<any>((f, t) =>
        supabase
          .from("course_sessions")
          .select(
            "id,session_date,start_time,end_time,assigned_trainer_id,courses(name,lanes,archived_at,schedule,trainers_needed)",
          )
          .gte("session_date", today)
          .order("id")
          .range(f, t),
      );
      const map: Record<string, TakenSession[]> = {};
      const crewMap: Record<string, Crew[]> = {};
      const sessions: { id: string; fixed: string | null; crew: Crew }[] = [];
      for (const r of rows) {
        if (r.courses?.archived_at) continue;
        if (new Date(`${r.session_date}T12:00:00Z`).getUTCDay() !== cfg.weekday) continue;
        const name = r.courses?.name ?? "Kurs";
        // Ältere Kurse haben die Uhrzeit nur im Text („samstags 12:00 - 12:45 Uhr“), nicht am Termin.
        const fromText = String(r.courses?.schedule ?? "").match(
          /(\d{1,2})[:.](\d{2})\s*(?:[-–]|bis)\s*(\d{1,2})[:.](\d{2})/,
        );
        let start: string | null = r.start_time ? String(r.start_time).slice(0, 5) : null;
        let end: string | null = r.end_time ? String(r.end_time).slice(0, 5) : null;
        if (!start && fromText) {
          start = hhmm(Number(fromText[1]) * 60 + Number(fromText[2]));
          end = hhmm(Number(fromText[3]) * 60 + Number(fromText[4]));
        }
        // Ganz ohne Uhrzeit: der Kurs belegt vorsichtshalber das ganze Bad und wird als „Uhrzeit fehlt“ gezeigt.
        const entry: TakenSession = start
          ? { start, end: end ?? hhmm(toMin(start) + 45), lanes: r.courses?.lanes ?? 1, name }
          : { start: "00:00", end: "23:59", lanes: cfg.lanes, name, noTime: true };
        (map[r.session_date] ??= []).push(entry);
        const crew: Crew = {
          name,
          ids: [],
          needed: r.courses?.trainers_needed ?? 2,
          start: entry.start,
          end: entry.end,
        };
        (crewMap[r.session_date] ??= []).push(crew);
        sessions.push({ id: r.id, fixed: r.assigned_trainer_id ?? null, crew });
      }
      setTaken(map);
      // Wer ist bereits eingeteilt? (Einteilungen im Dienstplan plus feste Zuordnung am Termin)
      const assigned = await fetchIn<{ session_id: string; trainer_id: string }>(
        sessions.map((m) => m.id),
        (chunk, f, t) =>
          db
            .from("course_session_assignments")
            .select("session_id,trainer_id")
            .in("session_id", chunk)
            .order("id")
            .range(f, t),
      );
      for (const { id, fixed, crew } of sessions) {
        const ids = new Set(assigned.filter((a) => a.session_id === id).map((a) => a.trainer_id));
        if (fixed) ids.add(fixed);
        crew.ids = [...ids];
      }
      setCrewOn(crewMap);
    } catch {
      setTaken({});
      setCrewOn({});
    }
  }, [cfg.weekday, cfg.lanes, today]);

  const loadTeam = useCallback(async () => {
    try {
      setTeam(await trainersFn());
    } catch {
      setTeam([]);
    }
    const prefs = await db
      .from("trainer_program_preferences")
      .select("trainer_id,program_id,preference");
    setPrefRows(
      (prefs.data ?? []).map((r: any) => ({
        trainerId: r.trainer_id,
        programId: r.program_id,
        pref: r.preference,
      })),
    );
    const [a, b] = await Promise.all([
      db
        .from("pool_slot_availability")
        .select("slot_date,trainer_id,available")
        .eq("pool", pool)
        .gte("slot_date", today),
      db.from("trainer_blackouts").select("*").gte("date_to", today),
    ]);
    setAvailRows(
      (a.data ?? []).map((r: any) => ({ d: r.slot_date, t: r.trainer_id, ok: r.available })),
    );
    setBlackouts(
      (b.data ?? []).map((r: any) => ({
        id: r.id,
        trainerId: r.trainer_id,
        from: r.date_from,
        to: r.date_to,
        weekdays: r.weekdays,
        note: r.note,
      })),
    );
  }, [pool, today, trainersFn]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);
  useEffect(() => {
    void loadSlots();
    void loadTaken();
    void loadTeam();
  }, [loadSlots, loadTaken, loadTeam]);

  // Warteliste je Kursangebot (jedes Kind nur einmal je Angebot).
  useEffect(() => {
    if (!courses.length && !programs.length) return;
    (async () => {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .select("program_id, course_id, child_name, child_dob, parent_email, available_from")
        .eq("status", "waiting");
      if (error) return setWaiting(null);
      const programOfCourse = new Map(courses.map((c) => [c.id, c.program_id]));
      const seen = new Set<string>();
      const list: Waiting[] = [];
      for (const r of data ?? []) {
        const program = r.program_id ?? (r.course_id ? programOfCourse.get(r.course_id) : null);
        if (!program) continue;
        const key = `${program}|${(r.child_name ?? r.parent_email).trim().toLowerCase()}|${r.child_dob ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ program, from: r.available_from });
      }
      setWaiting(list);
    })();
  }, [courses, programs.length]);

  const reloadAll = () => {
    void loadBase();
    void loadSlots();
    void loadTaken();
    void loadTeam();
  };

  return {
    today,
    programs,
    courses,
    slots,
    setSlots,
    sourceFile,
    loading,
    taken,
    crewOn,
    team,
    availRows,
    prefRows,
    blackouts,
    waiting,
    loadBase,
    loadSlots,
    loadTaken,
    reloadAll,
  };
}

export type PoolData = ReturnType<typeof usePoolData>;
