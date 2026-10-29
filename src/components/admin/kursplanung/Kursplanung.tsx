import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarPlus, FileUp, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { slugify, type Course, type ProgramRow } from "@/components/admin/kurse/shared";
import { supabase } from "@/integrations/supabase/client";
import { blackoutOn, type PlanBlackout } from "@/lib/dienstplan";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";
import { extractPlanLines } from "@/lib/pool-file";
import {
  POOLS,
  autoBlocks,
  blocksFit,
  holidayName,
  laneUsage,
  parsePoolSlots,
  planTerms,
  suggestByDemand,
  trainersNeeded,
  type KindSetting,
  type PlannedTerm,
  type PoolSlot,
  type TakenSession,
} from "@/lib/pool-schedule";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";

type Mode = "open" | "familie" | "entfaellt" | null;
type StoredSlot = PoolSlot & { mode: Mode };
type Kind = KindSetting & { max: number | null };
type Diff = { date: string; kind: "neu" | "geändert" | "entfällt"; was: string; now: string };
type Pending = { file: string; parsed: PoolSlot[]; diff: Diff[]; removed: string[] };
type Entry = { start: string; end: string; label: string; isNew: boolean; noTime?: boolean };

const wd = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
const fmt = (d: string) => `${wd(d)} ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const short = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;
const monthLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
const time = (s: PoolSlot | undefined) =>
  !s ? "—" : s.closed || !s.start ? "geschlossen" : `${s.start}–${s.end}`;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const MODE_LABEL: Record<string, string> = {
  std: "Normal",
  open: "Kurs findet statt",
  familie: "Familienschwimmen",
  entfaellt: "Entfällt",
};

function toStored(r: any): StoredSlot {
  return {
    date: r.slot_date,
    start: r.start_time ? String(r.start_time).slice(0, 5) : null,
    end: r.end_time ? String(r.end_time).slice(0, 5) : null,
    closed: !!r.closed,
    note: r.pdf_note ?? null,
    mode: (r.mode as Mode) ?? null,
  };
}

/** Kursplanung: Badtermine mit bereits belegten Kursen, Vorschlag neuer Zeiträume, Badplan-Upload. */
export function Kursplanung() {
  const db = supabase as any;
  const today = todayBerlinIso();
  const [pool, setPool] = useState(POOLS[0].id);
  const cfg = POOLS.find((p) => p.id === pool)!;
  const [tab, setTab] = useState("plan");

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [taken, setTaken] = useState<Record<string, TakenSession[]>>({});
  const [crewOn, setCrewOn] = useState<
    Record<string, { name: string; ids: string[]; needed: number }[]>
  >({});
  const [slots, setSlots] = useState<StoredSlot[]>([]);
  const [meta, setMeta] = useState<{ file: string | null; at: string | null }>({
    file: null,
    at: null,
  });
  const [loading, setLoading] = useState(false);

  const [waiting, setWaiting] = useState<{ program: string; from: string | null }[] | null>(null);
  const trainersFn = useServerFn(listTrainers);
  const [team, setTeam] = useState<TrainerOption[]>([]);
  const [availRows, setAvailRows] = useState<{ d: string; t: string; ok: boolean }[]>([]);
  const [blackouts, setBlackouts] = useState<PlanBlackout[]>([]);

  const [kinds, setKinds] = useState<Kind[]>([]);
  const [kindsPool, setKindsPool] = useState("");
  const [pause, setPause] = useState(15);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const [pending, setPending] = useState<Pending | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleTo, setRuleTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------- Laden ----------

  const loadBase = useCallback(async () => {
    try {
      setPrograms(
        await fetchAll<ProgramRow>((f, t) =>
          supabase.from("course_programs").select("*").order("sort_order").order("id").range(f, t),
        ),
      );
      setCourses(
        await fetchAll<Course>((f, t) =>
          supabase.from("courses").select("*").is("archived_at", null).order("id").range(f, t),
        ),
      );
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
    setMeta({ file: last?.source_file ?? null, at: last?.uploaded_at ?? null });
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
      const metas: {
        id: string;
        date: string;
        name: string;
        needed: number;
        fixed: string | null;
      }[] = [];
      for (const r of rows) {
        if (r.courses?.archived_at) continue;
        if (new Date(`${r.session_date}T12:00:00Z`).getUTCDay() !== cfg.weekday) continue;
        const lanes = r.courses?.lanes ?? 1;
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
          ? { start, end: end ?? hhmm(toMin(start) + 45), lanes, name }
          : { start: "00:00", end: "23:59", lanes: cfg.lanes, name, noTime: true };
        (map[r.session_date] ??= []).push(entry);
        metas.push({
          id: r.id,
          date: r.session_date,
          name,
          needed: r.courses?.trainers_needed ?? 2,
          fixed: r.assigned_trainer_id ?? null,
        });
      }
      setTaken(map);
      // Wer ist bereits eingeteilt? (Einteilungen im Dienstplan plus feste Zuordnung am Termin)
      const assigned = await fetchIn<{ session_id: string; trainer_id: string }>(
        metas.map((m) => m.id),
        (chunk, f, t) =>
          (supabase as any)
            .from("course_session_assignments")
            .select("session_id,trainer_id")
            .in("session_id", chunk)
            .order("id")
            .range(f, t),
      );
      const crewMap: typeof crewOn = {};
      for (const m of metas) {
        const ids = new Set(assigned.filter((a) => a.session_id === m.id).map((a) => a.trainer_id));
        if (m.fixed) ids.add(m.fixed);
        (crewMap[m.date] ??= []).push({ name: m.name, ids: [...ids], needed: m.needed });
      }
      setCrewOn(crewMap);
    } catch {
      setTaken({});
      setCrewOn({});
    }
  }, [cfg.weekday, today]);

  const loadTeam = useCallback(async () => {
    try {
      setTeam(await trainersFn());
    } catch {
      setTeam([]);
    }
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
  }, [pool, today]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);
  useEffect(() => {
    void loadSlots();
    void loadTaken();
    void loadTeam();
  }, [loadSlots, loadTaken, loadTeam]);

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
      const list: { program: string; from: string | null }[] = [];
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

  // ---------- Ableitungen ----------

  const poolPrograms = useMemo(() => {
    const hit = programs.filter((p) => cfg.match.test(`${p.location ?? ""} ${p.name}`));
    return hit.length ? hit : programs;
  }, [programs, cfg]);
  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? "Kurs";

  const latest = (programId: string, pick: (c: Course) => number | null | undefined) =>
    courses
      .filter((c) => c.program_id === programId && pick(c))
      .sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""))[0];
  const trainersFor = (id: string) => latest(id, (c) => c.trainers_needed)?.trainers_needed ?? 2;
  const maxFor = (k: Kind): number | null =>
    k.max ?? latest(k.id, (c) => c.max_participants)?.max_participants ?? null;
  // Einheiten je Zeitraum wie beim letzten Zeitraum desselben Angebots (z. B. 8), sonst 10.
  const unitsFor = (id: string): number =>
    Math.min(30, latest(id, (c) => c.unit_count)?.unit_count ?? 10);

  // Standard-Kursarten je Bad: Seepferdchen, Bronze je 1 Bahn, Aufbaukurs 2 Bahnen, 45 Minuten, 10 Einheiten.
  useEffect(() => {
    if (kindsPool === pool || !programs.length) return;
    setKindsPool(pool);
    const base = poolPrograms
      .filter((p) => /seepferd|bronze|aufbau/i.test(p.name))
      .map((p) => ({
        id: p.id,
        lanes: Math.min(cfg.lanes, /aufbau/i.test(p.name) ? 2 : 1),
        minutes: 45,
        units: unitsFor(p.id),
        trainers: trainersFor(p.id),
        count: 1,
      }));
    const blocks = autoBlocks(base, cfg.lanes);
    setKinds(base.map((k) => ({ ...k, block: blocks[k.id], max: null })));
    setToggled({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, pool, kindsPool, courses]);

  function skipReason(s: StoredSlot): string | undefined {
    if (s.mode === "familie") return "Familienschwimmen";
    if (s.mode === "entfaellt") return "Termin entfällt";
    if (s.mode === "open") return undefined;
    const h = holidayName(s.date);
    return h ? `Feiertag (${h})` : undefined;
  }

  const future = useMemo(() => slots.filter((s) => s.date >= today), [slots, today]);
  const skip = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of future) {
      const r = skipReason(s);
      if (r) m[s.date] = r;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [future]);

  const terms = useMemo(
    () => planTerms(future, skip, kinds, pause, cfg.lanes, taken),
    [future, skip, kinds, pause, cfg.lanes, taken],
  );

  const need = trainersNeeded(kinds, cfg.lanes);
  const surveyed = availRows.length > 0;
  function staffing(date: string) {
    let yes = 0;
    let no = 0;
    let unknown = 0;
    for (const m of team) {
      const a = availRows.find((r) => r.d === date && r.t === m.id);
      if (blackoutOn(blackouts, m.id, date) || a?.ok === false) no++;
      else if (a?.ok) yes++;
      else unknown++;
    }
    return { yes, no, unknown };
  }

  function overlap(t: PlannedTerm): string | null {
    const first = t.sessions[0].date;
    const last = t.sessions[t.sessions.length - 1].date;
    const hit = courses.find(
      (c) =>
        c.program_id === t.track.kindId &&
        c.starts_on &&
        c.ends_on &&
        c.starts_on <= last &&
        c.ends_on >= first,
    );
    return hit ? `${hit.name} (${short(hit.starts_on!)}–${short(hit.ends_on!)})` : null;
  }
  const thin = (t: PlannedTerm) =>
    t.sessions.map((s) => s.date).filter((d) => staffing(d).yes < need);
  const isSelected = (t: PlannedTerm) =>
    toggled[t.id] ?? (t.complete && !overlap(t) && !(surveyed && thin(t).length > 0));
  const chosen = terms.filter(isSelected);

  // Bereits vergebene und vorgeschlagene Kurse je Termin.
  const entriesOn = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    for (const [d, list] of Object.entries(taken))
      for (const t of list)
        (m[d] ??= []).push({
          start: t.start,
          end: t.end,
          label: t.name,
          isNew: false,
          noTime: t.noTime,
        });
    for (const t of chosen)
      for (const s of t.sessions)
        (m[s.date] ??= []).push({
          start: s.start,
          end: s.end,
          label: programName(t.track.kindId),
          isNew: true,
        });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, chosen, programs]);

  const typical = future.find((s) => !s.closed && s.start);
  const blockMinutes = kinds[0]?.minutes ?? 45;
  const nBlocks = Math.min(4, Math.max(1, typical ? blocksFit(typical, blockMinutes, pause) : 2));
  // Wie viele Kurse einer Art pro Tag in die Badezeit passen (ab ihrem Zeitblock, nebeneinander oder nacheinander).
  const noFit = kinds
    .filter((k) => k.count > 0)
    .map((k) => {
      const perBlock = Math.max(1, Math.floor(cfg.lanes / k.lanes));
      const blocksLeft = typical ? Math.max(0, blocksFit(typical, k.minutes, pause) - k.block) : 0;
      return { k, fit: blocksLeft * perBlock };
    })
    .filter((x) => x.fit < x.k.count);
  const usage = laneUsage(kinds, cfg.lanes);

  const demandFor = (programId: string, byDate: string | null) =>
    waiting
      ? waiting.filter(
          (w) => w.program === programId && (!w.from || !byDate || w.from.slice(0, 10) <= byDate),
        ).length
      : 0;
  const demandOf = (k: Kind) =>
    demandFor(k.id, future[Math.min(k.units, future.length) - 1]?.date ?? null);

  // ---------- Aktionen ----------

  async function setMode(s: StoredSlot, v: string) {
    const mode = v === "std" ? null : (v as Mode);
    setSlots((all) => all.map((x) => (x.date === s.date ? { ...x, mode } : x)));
    const { error } = await db
      .from("pool_slots")
      .update({ mode })
      .eq("pool", pool)
      .eq("slot_date", s.date);
    if (error) toast.error(error.message);
  }

  async function setModeMany(dates: string[], mode: Mode, okText: string) {
    if (!dates.length) return toast.info("Keine passenden Termine.");
    const { error } = await db
      .from("pool_slots")
      .update({ mode })
      .eq("pool", pool)
      .in("slot_date", dates);
    if (error) return toast.error(error.message);
    toast.success(`${dates.length} ${okText}`);
    await loadSlots();
  }

  const markFirstOfMonth = () =>
    setModeMany(
      future.filter((s) => s.date.slice(8) <= "07" && s.mode !== "familie").map((s) => s.date),
      "familie",
      `Termine als Familienschwimmen markiert`,
    );

  const blockUnderstaffed = () =>
    setModeMany(
      future
        .filter((s) => !s.closed && !skipReason(s))
        .filter((s) => {
          const st = staffing(s.date);
          return st.yes + st.unknown < need;
        })
        .map((s) => s.date),
      "entfaellt",
      "Termine gesperrt (zu wenige Trainer)",
    );

  function applyDemand() {
    if (!waiting) return toast.error("Die Warteliste konnte nicht gelesen werden.");
    const blocks = typical
      ? Math.max(0, ...kinds.map((k) => blocksFit(typical, k.minutes, pause)))
      : 0;
    const counts = suggestByDemand(
      kinds.map((k) => ({ id: k.id, lanes: k.lanes, demand: demandOf(k), max: maxFor(k) })),
      cfg.lanes,
      blocks,
    );
    const next = kinds.map((k) => ({ ...k, count: counts[k.id] ?? 0 }));
    const placed = autoBlocks(next, cfg.lanes);
    setKinds(next.map((k) => ({ ...k, block: placed[k.id] })));
    setToggled({});
    toast.success("Vorschlag nach Nachfrage erstellt – bitte prüfen und anpassen.");
  }

  function stage(parsed: PoolSlot[], fileName: string) {
    const old = new Map(slots.map((s) => [s.date, s]));
    const first = parsed[0].date;
    const last = parsed[parsed.length - 1].date;
    const diff: Diff[] = [];
    for (const n of parsed) {
      const o = old.get(n.date);
      if (!o) diff.push({ date: n.date, kind: "neu", was: "—", now: time(n) });
      else if (time(o) !== time(n))
        diff.push({ date: n.date, kind: "geändert", was: time(o), now: time(n) });
    }
    const inNew = new Set(parsed.map((p) => p.date));
    const removed = slots
      .filter((s) => s.date >= first && s.date <= last && !inNew.has(s.date) && !s.closed)
      .map((s) => s.date);
    for (const d of removed)
      diff.push({ date: d, kind: "entfällt", was: time(old.get(d)), now: "nicht mehr im Plan" });
    diff.sort((a, b) => a.date.localeCompare(b.date));
    setPending({ file: fileName, parsed, diff, removed });
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = parsePoolSlots(await extractPlanLines(f), cfg.weekday);
      if (!parsed.length) return toast.error("In der Datei wurden keine Nutzungstermine erkannt.");
      stage(parsed, f.name);
    } catch (e: any) {
      toast.error(`Datei konnte nicht gelesen werden: ${e?.message ?? e}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function generateRule() {
    if (!cfg.rule) return;
    if (!ruleFrom || !ruleTo || ruleTo < ruleFrom) return toast.error("Bitte Zeitraum angeben.");
    const parsed: PoolSlot[] = [];
    for (
      let d = new Date(`${ruleFrom}T12:00:00Z`);
      d <= new Date(`${ruleTo}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      if (d.getUTCDay() !== cfg.weekday) continue;
      parsed.push({
        date: d.toISOString().slice(0, 10),
        start: cfg.rule.start,
        end: cfg.rule.end,
        closed: false,
        note: null,
      });
    }
    if (!parsed.length) return toast.error(`Im Zeitraum liegt kein ${cfg.dayName}.`);
    stage(parsed, `Regel: ${cfg.dayName} ${cfg.rule.start}–${cfg.rule.end} Uhr`);
  }

  async function applyPlan() {
    if (!pending) return;
    setBusy(true);
    const rows = pending.parsed.map((s) => ({
      pool,
      slot_date: s.date,
      start_time: s.start,
      end_time: s.end,
      closed: s.closed,
      pdf_note: s.note,
      source_file: pending.file,
      uploaded_at: new Date().toISOString(),
    }));
    // „mode“ fehlt absichtlich: eigene Festlegungen bleiben bei bestehenden Terminen erhalten.
    const up = await db.from("pool_slots").upsert(rows, { onConflict: "pool,slot_date" });
    if (up.error) {
      setBusy(false);
      return toast.error(up.error.message);
    }
    if (pending.removed.length) {
      const rm = await db
        .from("pool_slots")
        .update({ closed: true, pdf_note: "nicht mehr im Plan", source_file: pending.file })
        .eq("pool", pool)
        .in("slot_date", pending.removed);
      if (rm.error) {
        setBusy(false);
        return toast.error(rm.error.message);
      }
    }
    const list: string[] = [];
    for (const d of pending.diff) {
      for (const t of taken[d.date] ?? [])
        list.push(`${fmt(d.date)}: ${t.name} (${t.start} Uhr) – Bad jetzt ${d.now}`);
    }
    setConflicts(list);
    setBusy(false);
    setPending(null);
    toast.success(`Badplan übernommen (${pending.diff.length} Änderungen)`);
    await loadSlots();
    setTab(list.length ? "badplan" : "plan");
  }

  async function createTerms() {
    if (!chosen.length) return toast.error("Kein Kurszeitraum ausgewählt.");
    if (!window.confirm(`${chosen.length} Kurszeiträume mit Terminen anlegen?`)) return;
    setBusy(true);
    const used = new Set(courses.map((c) => c.slug));
    let made = 0;
    for (const t of chosen) {
      const p = programs.find((x) => x.id === t.track.kindId);
      const k = kinds.find((x) => x.id === t.track.kindId);
      if (!p || !k) continue;
      const first = t.sessions[0];
      const last = t.sessions[t.sessions.length - 1];
      let slug = slugify(`${p.name} ${first.date}${t.track.copy > 1 ? ` ${t.track.copy}` : ""}`);
      for (let i = 2; used.has(slug); i++) slug = `${slugify(`${p.name} ${first.date}`)}-${i}`;
      used.add(slug);
      const res = await supabase
        .from("courses")
        .insert({
          name: p.name,
          slug,
          description: p.description,
          target_group: p.target_group,
          age_range: p.age_range,
          duration: p.duration,
          location: p.location,
          status: "planned",
          max_participants: maxFor(k),
          starts_on: first.date,
          ends_on: last.date,
          schedule: `${wd(first.date)} ${first.start}–${first.end} Uhr`,
          is_public: true,
          price_member: p.price_member,
          price_non_member: p.price_non_member,
          payment_due_days: p.payment_due_days,
          program_id: p.id,
          unit_count: t.sessions.length,
          course_info: p.course_info,
          lanes: k.lanes,
          trainers_needed: k.trainers,
          session_breaks: t.breaks,
        } as any)
        .select("id")
        .single();
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "Kurs konnte nicht angelegt werden");
        break;
      }
      const ins = await supabase.from("course_sessions").insert(
        t.sessions.map((s, i) => ({
          course_id: res.data.id,
          session_index: i + 1,
          session_date: s.date,
          start_time: s.start,
          end_time: s.end,
        })),
      );
      if (ins.error) {
        await supabase.from("courses").delete().eq("id", res.data.id);
        toast.error(ins.error.message);
        break;
      }
      made++;
    }
    setBusy(false);
    if (made) {
      toast.success(`${made} Kurszeiträume angelegt (Status „Geplant“)`);
      setToggled({});
      await Promise.all([loadBase(), loadTaken()]);
    }
  }

  // ---------- Darstellung ----------

  const months = useMemo(() => {
    const m = new Map<string, StoredSlot[]>();
    for (const s of future) m.set(s.date.slice(0, 7), [...(m.get(s.date.slice(0, 7)) ?? []), s]);
    return [...m.entries()];
  }, [future]);

  const counts = useMemo(() => {
    let blocked = 0;
    let withCourses = 0;
    let free = 0;
    for (const s of future) {
      if (s.closed || skipReason(s)) blocked++;
      else if ((entriesOn[s.date] ?? []).length) withCourses++;
      else free++;
    }
    return { blocked, withCourses, free };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [future, entriesOn]);

  const chipFor = (e: Entry, key: string) => (
    <div
      key={key}
      title={`${e.label} ${e.start}–${e.end}${e.isNew ? " (Vorschlag)" : ""}`}
      className={`mb-0.5 rounded border px-1.5 py-0.5 text-xs leading-tight ${
        e.isNew
          ? "border-dashed border-emerald-500 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-slate-100 text-slate-800"
      }`}
    >
      {e.noTime ? `${e.label} (Uhrzeit fehlt)` : `${e.start} ${e.label}`}
    </div>
  );

  function blockCell(s: StoredSlot, b: number) {
    if (!s.start) return null;
    const from = toMin(s.start) + b * (blockMinutes + pause);
    const to = from + blockMinutes;
    const list = (entriesOn[s.date] ?? []).filter(
      (e) => toMin(e.start) < to && toMin(e.end) > from,
    );
    return (
      <td key={b} className="border-l p-1 align-top">
        <div className="mb-0.5 text-[10px] text-muted-foreground">{hhmm(from)}</div>
        {list.length ? (
          list.map((e, i) => chipFor(e, `${e.label}${e.start}${i}`))
        ) : (
          <span className="text-xs text-emerald-700">frei</span>
        )}
      </td>
    );
  }

  const poolButtons = (
    <div className="flex flex-wrap gap-2">
      {POOLS.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={p.id === pool ? "default" : "outline"}
          onClick={() => {
            setPool(p.id);
            setPending(null);
            setConflicts([]);
            setToggled({});
          }}
        >
          {p.name} · {p.dayName}s
        </Button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarPlus className="h-6 w-6" /> Kursplanung
          </h1>
          <p className="text-sm text-muted-foreground">
            Welche Badtermine gibt es, was läuft dort schon, und welche neuen Kurszeiträume passen
            hinein?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {poolButtons}
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              void loadBase();
              void loadSlots();
              void loadTaken();
              void loadTeam();
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="plan">Terminplan</TabsTrigger>
          <TabsTrigger value="vorschlag">
            Vorschlag{terms.length ? ` (${chosen.length}/${terms.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="badplan">
            Badplan{conflicts.length ? ` (${conflicts.length} betroffen)` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Terminplan ---------------- */}
        <TabsContent value="plan" className="mt-4 space-y-3">
          {!future.length ? (
            <div className="rounded-md border p-4 text-sm">
              Für das {cfg.name} gibt es noch keine Nutzungstermine.{" "}
              <Button size="sm" variant="outline" onClick={() => setTab("badplan")}>
                Badplan hochladen
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{future.length} Termine</Badge>
                <Badge variant="outline" className="text-emerald-700">
                  {counts.free} frei
                </Badge>
                <Badge variant="outline">{counts.withCourses} mit Kursen</Badge>
                <Badge variant="outline">{counts.blocked} gesperrt</Badge>
                <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    <span className="mr-1 inline-block h-2.5 w-2.5 rounded border border-slate-300 bg-slate-100" />
                    läuft bereits
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2.5 w-2.5 rounded border border-dashed border-emerald-500 bg-emerald-50" />
                    Vorschlag
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-muted-foreground/30" />
                    gesperrt
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={markFirstOfMonth}>
                  Jeden 1. {cfg.dayName} im Monat = Familienschwimmen
                </Button>
                {surveyed && (
                  <Button size="sm" variant="outline" onClick={blockUnderstaffed}>
                    Termine ohne genug Trainer sperren
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="p-1.5 text-left">Termin</th>
                      <th className="p-1.5 text-left">Badzeit</th>
                      <th className="w-44 p-1.5 text-left">Nutzung</th>
                      {Array.from({ length: nBlocks }, (_, b) => (
                        <th key={b} className="border-l p-1.5 text-left">
                          Block {b + 1}
                        </th>
                      ))}
                      <th className="border-l p-1.5 text-left">Trainer</th>
                    </tr>
                  </thead>
                  {months.map(([m, list]) => (
                    <tbody key={m}>
                      <tr>
                        <td
                          colSpan={4 + nBlocks}
                          className="bg-muted/50 px-1.5 py-1 text-xs font-semibold"
                        >
                          {monthLabel(`${m}-01`)}
                        </td>
                      </tr>
                      {list.map((s) => {
                        const reason = s.closed ? "Hallenbad geschlossen" : skipReason(s);
                        const st = staffing(s.date);
                        const trainerColor =
                          st.yes + st.unknown < need
                            ? "text-red-600 font-semibold"
                            : st.yes < need
                              ? "text-amber-700"
                              : "text-emerald-700";
                        return (
                          <tr
                            key={s.date}
                            className={`border-b align-top ${reason ? "bg-muted/40" : ""}`}
                          >
                            <td className="whitespace-nowrap p-1.5 font-medium">{fmt(s.date)}</td>
                            <td className="whitespace-nowrap p-1.5 text-xs">
                              {time(s)}
                              {s.note && (
                                <div className="max-w-[10rem] text-[10px] text-muted-foreground">
                                  {s.note}
                                </div>
                              )}
                            </td>
                            <td className="p-1">
                              {s.closed ? (
                                <span className="text-xs">Bad geschlossen</span>
                              ) : (
                                <Select
                                  value={s.mode ?? "std"}
                                  onValueChange={(v) => setMode(s, v)}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(MODE_LABEL).map(([v, l]) => (
                                      <SelectItem key={v} value={v}>
                                        {v === "std" && holidayName(s.date)
                                          ? `Feiertag – entfällt`
                                          : l}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            {reason ? (
                              <td
                                colSpan={nBlocks}
                                className="border-l p-1.5 text-xs text-muted-foreground"
                              >
                                {reason}
                              </td>
                            ) : (
                              Array.from({ length: nBlocks }, (_, b) => blockCell(s, b))
                            )}
                            <td className="min-w-[12rem] border-l p-1.5 text-xs">
                              {(crewOn[s.date] ?? []).map((c, i) => {
                                const names = c.ids.map(
                                  (id) => team.find((m) => m.id === id)?.name ?? "?",
                                );
                                const gap = Math.max(0, c.needed - c.ids.length);
                                return (
                                  <div key={`${c.name}${i}`} className="mb-0.5 leading-tight">
                                    <span className="text-muted-foreground">{c.name}: </span>
                                    {names.length ? names.join(", ") : "niemand"}
                                    {gap > 0 && (
                                      <span className="font-semibold text-red-600">
                                        {" "}
                                        – {gap} fehlt
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {!reason && surveyed && (
                                <div className={trainerColor}>
                                  Abfrage: {st.yes} zu · {st.unknown} offen
                                </div>
                              )}
                              {!(crewOn[s.date] ?? []).length && (reason || !surveyed) && "–"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- Vorschlag ---------------- */}
        <TabsContent value="vorschlag" className="mt-4 space-y-5">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  1. Welche Kurse sollen pro {cfg.dayName} laufen?
                </div>
                <p className="text-xs text-muted-foreground">
                  {cfg.name} hat {cfg.lanes} {cfg.lanes === 1 ? "Bahn (nur ganzes Bad)" : "Bahnen"}.
                  Kurse im selben Block laufen gleichzeitig, der nächste Block beginnt danach.
                  „Anzahl“ 0 = dieses Angebot nicht planen.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={applyDemand}>
                <Wand2 className="h-4 w-4" /> Nach Warteliste vorschlagen
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {kinds.map((k) => {
                const set = (patch: Partial<Kind>) =>
                  setKinds((all) => all.map((x) => (x.id === k.id ? { ...x, ...patch } : x)));
                const num = (v: string, min = 1) => Math.max(min, Number(v) || min);
                const dem = demandOf(k);
                const mx = maxFor(k);
                const field = (label: string, el: React.ReactNode) => (
                  <label className="text-[11px] text-muted-foreground">
                    {label}
                    {el}
                  </label>
                );
                return (
                  <div
                    key={k.id}
                    className={`rounded-md border p-2.5 ${k.count === 0 ? "opacity-60" : ""}`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                      <span className="text-sm font-semibold">{programName(k.id)}</span>
                      <span className="flex items-center gap-2 text-xs">
                        {waiting === null
                          ? ""
                          : `${dem} wartend${mx ? ` (≈ ${(dem / mx).toFixed(1)} Kurse)` : ""}`}
                        <button
                          type="button"
                          title="Dieses Kursangebot aus der Planung entfernen"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setKinds((all) => all.filter((x) => x.id !== k.id));
                            setToggled({});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {field(
                        "Kurse pro Tag",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.count}
                          onChange={(e) => set({ count: num(e.target.value, 0) })}
                        />,
                      )}
                      {field(
                        "Bahnen",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.lanes}
                          onChange={(e) => set({ lanes: Math.min(cfg.lanes, num(e.target.value)) })}
                        />,
                      )}
                      {field(
                        "Minuten",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.minutes}
                          onChange={(e) => set({ minutes: num(e.target.value, 15) })}
                        />,
                      )}
                      {field(
                        "Termine je Kurs",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.units}
                          onChange={(e) => set({ units: Math.min(30, num(e.target.value)) })}
                        />,
                      )}
                      {field(
                        "Block",
                        <Select
                          value={String(k.block)}
                          onValueChange={(v) => set({ block: Number(v) })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2].map((b) => (
                              <SelectItem key={b} value={String(b)}>
                                {b + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>,
                      )}
                      {field(
                        "Plätze",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.max ?? mx ?? ""}
                          onChange={(e) =>
                            set({ max: e.target.value ? Number(e.target.value) : null })
                          }
                        />,
                      )}
                      {field(
                        "Trainer",
                        <Input
                          className="h-8"
                          type="number"
                          value={k.trainers}
                          onChange={(e) => set({ trainers: Math.min(10, num(e.target.value)) })}
                        />,
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {programs.some((p) => !kinds.some((k) => k.id === p.id)) && (
              <Select
                value=""
                onValueChange={(id) =>
                  setKinds((all) => [
                    ...all,
                    {
                      id,
                      lanes: Math.min(cfg.lanes, /aufbau/i.test(programName(id)) ? 2 : 1),
                      minutes: 45,
                      units: unitsFor(id),
                      trainers: trainersFor(id),
                      count: 1,
                      block: 0,
                      max: null,
                    },
                  ])
                }
              >
                <SelectTrigger className="h-8 w-72">
                  <SelectValue placeholder="Kursangebot hinzufügen…" />
                </SelectTrigger>
                <SelectContent>
                  {/* Alle Angebote, die zum Bad passenden zuerst */}
                  {programs
                    .filter((p) => !kinds.some((k) => k.id === p.id))
                    .sort(
                      (a, b) =>
                        Number(cfg.match.test(`${b.location ?? ""} ${b.name}`)) -
                        Number(cfg.match.test(`${a.location ?? ""} ${a.name}`)),
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.location ? ` · ${p.location}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {Object.entries(usage).map(([b, n]) => (
                <span
                  key={b}
                  className={n > cfg.lanes ? "font-semibold text-red-600" : "text-muted-foreground"}
                >
                  Block {Number(b) + 1}: {n}/{cfg.lanes} Bahnen{n > cfg.lanes ? " – zu viele!" : ""}
                </span>
              ))}
              {noFit.map(({ k, fit }) => (
                <span key={k.id} className="font-semibold text-red-600">
                  {programName(k.id)}: nur {fit} von {k.count} Kursen pro Tag passen in die Badezeit
                  ({time(typical)})
                </span>
              ))}
              <label className="flex items-center gap-1">
                Pause zwischen Blöcken (Min.)
                <Input
                  className="h-7 w-16"
                  type="number"
                  value={pause}
                  onChange={(e) => setPause(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">2. Vorgeschlagene Kurszeiträume</div>
                <p className="text-xs text-muted-foreground">
                  Bereits laufende Kurse, gesperrte Termine und Feiertage sind berücksichtigt. Was
                  du ankreuzt, siehst du im Terminplan gestrichelt.
                </p>
              </div>
              <Button disabled={busy || !chosen.length} onClick={createTerms}>
                <CalendarPlus className="h-4 w-4" /> {chosen.length} anlegen
              </Button>
            </div>
            {!terms.length && (
              <p className="text-sm text-muted-foreground">
                Mit diesen Einstellungen ist kein Zeitraum möglich.
              </p>
            )}
            <div className="space-y-1">
              {terms.map((t) => {
                const ov = overlap(t);
                const first = t.sessions[0];
                const last = t.sessions[t.sessions.length - 1];
                const k = kinds.find((x) => x.id === t.track.kindId)!;
                const th = surveyed ? thin(t) : [];
                const isFirst = terms.find((x) => x.track.id === t.track.id) === t;
                const odd = t.sessions.filter((s) => s.start !== first.start);
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-start gap-3 rounded border p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={isSelected(t)}
                      onChange={(e) => setToggled((m) => ({ ...m, [t.id]: e.target.checked }))}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {programName(t.track.kindId)}
                        {k.count > 1 ? ` ${t.track.copy}` : ""}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {fmt(first.date)} bis {fmt(last.date)} · {t.sessions.length} Termine ·{" "}
                          {first.start}–{first.end} Uhr
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                        {isFirst && waiting !== null && (
                          <Badge variant="outline" className="text-emerald-700">
                            {demandFor(t.track.kindId, first.date)} wartend
                          </Badge>
                        )}
                        {t.breaks.length > 0 && (
                          <Badge variant="outline">
                            Pausen: {t.breaks.map((b) => `${short(b.date)} ${b.note}`).join(", ")}
                          </Badge>
                        )}
                        {odd.length > 0 && (
                          <Badge variant="outline">
                            andere Zeit: {odd.map((s) => `${short(s.date)} ${s.start}`).join(", ")}
                          </Badge>
                        )}
                        {!t.complete && (
                          <Badge variant="outline" className="text-amber-700">
                            nur {t.sessions.length} von {k.units} Terminen (Vertragsende)
                          </Badge>
                        )}
                        {th.length > 0 && (
                          <Badge variant="outline" className="text-amber-700">
                            zu wenig Trainer:{" "}
                            {th.map((d) => `${short(d)} ${staffing(d).yes}/${need}`).join(", ")}
                          </Badge>
                        )}
                        {ov && (
                          <Badge variant="outline" className="text-red-600">
                            überschneidet {ov}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </TabsContent>

        {/* ---------------- Badplan ---------------- */}
        <TabsContent value="badplan" className="mt-4 space-y-4">
          <section className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Nutzungsplan {cfg.name}</div>
                <p className="text-xs text-muted-foreground">
                  {slots.length
                    ? `${slots.length} Termine gespeichert (${fmt(slots[0].date)} bis ${fmt(slots[slots.length - 1].date)})${meta.file ? `, zuletzt aus „${meta.file}“` : ""}. Ein neuer Plan überschreibt die Zeiten je Datum, deine Sperren bleiben erhalten.`
                    : "Noch kein Plan gespeichert."}{" "}
                  Möglich: PDF, Excel, Word, CSV oder Text.
                </p>
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xlsm,.docx,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" />{" "}
                  {slots.length ? "Neuen Plan hochladen" : "Plan hochladen"}
                </Button>
              </div>
            </div>

            {cfg.rule && (
              <div className="flex flex-wrap items-end gap-2 border-t pt-2 text-sm">
                <span className="w-full text-xs text-muted-foreground">
                  {cfg.name}: feste Nutzungszeit {cfg.dayName}s {cfg.rule.start}–{cfg.rule.end} Uhr,
                  nur das ganze Bad. Zeitraum angeben, die Termine werden vorgeschlagen:
                </span>
                <label className="text-xs">
                  von
                  <Input
                    className="h-8 w-40"
                    type="date"
                    value={ruleFrom}
                    onChange={(e) => setRuleFrom(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  bis
                  <Input
                    className="h-8 w-40"
                    type="date"
                    value={ruleTo}
                    onChange={(e) => setRuleTo(e.target.value)}
                  />
                </label>
                <Button size="sm" variant="outline" onClick={generateRule}>
                  {cfg.dayName}e erzeugen
                </Button>
              </div>
            )}
          </section>

          {pending && (
            <section className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
              <div className="font-medium">
                {pending.file}: {pending.parsed.length} Termine erkannt,{" "}
                {pending.diff.length
                  ? `${pending.diff.length} Änderungen zum gespeicherten Plan`
                  : "keine Änderungen"}
              </div>
              {pending.diff.length > 0 && (
                <ul className="max-h-60 space-y-0.5 overflow-y-auto text-xs">
                  {pending.diff.map((d) => (
                    <li key={d.date}>
                      <Badge variant="outline" className="mr-2">
                        {d.kind}
                      </Badge>
                      {fmt(d.date)}: {d.was} → {d.now}
                      {(taken[d.date] ?? []).length > 0 && (
                        <span className="ml-2 font-semibold text-red-600">
                          Achtung: {(taken[d.date] ?? []).map((t) => t.name).join(", ")} läuft schon
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={applyPlan}>
                  Plan übernehmen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                  Verwerfen
                </Button>
              </div>
            </section>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Bereits angelegte Kurse sind betroffen – bitte
                Termine prüfen und Eltern informieren:
              </div>
              {conflicts.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
