import { AlertTriangle, CalendarPlus, FileUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { blackoutOn, type PlanBlackout } from "@/lib/dienstplan";
import { extractPlanLines } from "@/lib/pool-file";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import {
  POOLS,
  autoBlocks,
  blocksFit,
  holidayName,
  laneUsage,
  trainersNeeded,
  suggestByDemand,
  parsePoolSlots,
  planTerms,
  type KindSetting,
  type PlannedTerm,
  type PoolSlot,
} from "@/lib/pool-schedule";
import { slugify, type Course, type ProgramRow } from "@/components/admin/kurse/shared";

type Mode = "open" | "familie" | "entfaellt" | null;
type StoredSlot = PoolSlot & { mode: Mode };
type Kind = KindSetting & { max: number | null };
type Diff = { date: string; kind: "neu" | "geändert" | "entfällt"; was: string; now: string };
type Pending = { file: string; parsed: PoolSlot[]; diff: Diff[]; removed: string[] };

const wd = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
const fmt = (d: string) => `${wd(d)} ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const short = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;
const time = (s: PoolSlot | undefined) =>
  !s ? "—" : s.closed || !s.start ? "geschlossen" : `${s.start}–${s.end}`;

const MODE_LABEL: Record<string, string> = {
  std: "Standard",
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

/** Kursplanung aus dem Nutzungsvertrag: Plan hochladen, Sperren setzen, Kurszeiträume vorschlagen und anlegen. */
export function PoolPlanDialog({
  open,
  onOpenChange,
  programs,
  courses,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: ProgramRow[];
  courses: Course[];
  onCreated: () => void | Promise<void>;
}) {
  const [pool, setPool] = useState(POOLS[0].id);
  // Wartende Kinder (ein Eintrag je Kind und Kursangebot), für die Nachfrage-Auswertung.
  const [waiting, setWaiting] = useState<{ program: string; from: string | null }[] | null>(null);
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleTo, setRuleTo] = useState("");
  const cfg = POOLS.find((p) => p.id === pool)!;
  const [kindsPool, setKindsPool] = useState("");
  const [slots, setSlots] = useState<StoredSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [pause, setPause] = useState(0);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function loadSlots() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("pool_slots")
      .select("*")
      .eq("pool", pool)
      .order("slot_date");
    setLoading(false);
    if (error)
      return toast.error(
        `Nutzungstermine konnten nicht geladen werden (${error.message}). Wurde die Migration 20261029100000 eingespielt?`,
      );
    setSlots((data ?? []).map(toStored));
  }

  useEffect(() => {
    if (open) void loadSlots();
  }, [open, pool]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, courses]);

  /** Wartende für ein Kursangebot, die bis zum angegebenen Tag Platz haben dürfen. */
  function demandFor(programId: string, byDate: string | null): number {
    if (!waiting) return 0;
    return waiting.filter(
      (w) => w.program === programId && (!w.from || !byDate || w.from.slice(0, 10) <= byDate),
    ).length;
  }

  // Trainer-Einsatzmöglichkeiten (Abfrage im Voraus), Sperrzeiten und Teamliste.
  const trainersFn = useServerFn(listTrainers);
  const [team, setTeam] = useState<TrainerOption[]>([]);
  const [availRows, setAvailRows] = useState<{ d: string; t: string; ok: boolean }[]>([]);
  const [blackouts, setBlackouts] = useState<PlanBlackout[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setTeam(await trainersFn());
      } catch {
        setTeam([]);
      }
      const db = supabase as any;
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
    })();
  }, [open, pool]);

  /** Zusagen, Absagen (inkl. Sperrzeiten) und offene Antworten für einen Termin. */
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
  const surveyed = availRows.length > 0;

  const trainersFor = (programId: string): number =>
    courses
      .filter((c) => c.program_id === programId && c.trainers_needed)
      .sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""))[0]?.trainers_needed ??
    2;

  // Standard-Kursarten: Seepferdchen, Bronze je 1 Bahn, Aufbaukurs 2 Bahnen, je 45 Minuten, 10 Einheiten.
  useEffect(() => {
    if (!open || kindsPool === pool || !programs.length) return;
    setKindsPool(pool);
    const base = poolPrograms
      .filter((p) => /seepferd|bronze|aufbau/i.test(p.name))
      .map((p) => ({
        id: p.id,
        lanes: Math.min(cfg.lanes, /aufbau/i.test(p.name) ? 2 : 1),
        minutes: 45,
        units: 10,
        trainers: trainersFor(p.id),
        count: 1,
      }));
    const blocks = autoBlocks(base, cfg.lanes);
    setKinds(base.map((k) => ({ ...k, block: blocks[k.id], max: null })));
  }, [open, programs, pool, kindsPool]);

  const poolPrograms = useMemo(() => {
    const hit = programs.filter((p) => cfg.match.test(`${p.location ?? ""} ${p.name}`));
    return hit.length ? hit : programs;
  }, [programs, cfg]);
  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? "Kurs";

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
  }, [future]);

  const terms = useMemo(
    () => planTerms(future, skip, kinds, pause, cfg.lanes),
    [future, skip, kinds, pause],
  );

  function overlap(t: PlannedTerm): string | null {
    const first = t.sessions[0].date;
    const last = t.sessions[t.sessions.length - 1].date;
    const hit = courses.find(
      (c) =>
        !c.archived_at &&
        c.program_id === t.track.kindId &&
        c.starts_on &&
        c.ends_on &&
        c.starts_on <= last &&
        c.ends_on >= first,
    );
    return hit ? `${hit.name} (${short(hit.starts_on!)}–${short(hit.ends_on!)})` : null;
  }
  // Termine eines Zeitraums, an denen weniger Trainer zugesagt haben als nötig (nur wenn abgefragt wurde).
  const thin = (t: PlannedTerm) =>
    t.sessions.map((s) => s.date).filter((d) => staffing(d).yes < need);
  const isSelected = (t: PlannedTerm) =>
    toggled[t.id] ?? (t.complete && !overlap(t) && !(surveyed && thin(t).length > 0));

  async function setMode(s: StoredSlot, v: string) {
    const mode = v === "std" ? null : (v as Mode);
    setSlots((all) => all.map((x) => (x.date === s.date ? { ...x, mode } : x)));
    const { error } = await (supabase as any)
      .from("pool_slots")
      .update({ mode })
      .eq("pool", pool)
      .eq("slot_date", s.date);
    if (error) toast.error(error.message);
  }

  /** Jeden ersten Samstag im Monat als Familienschwimmen markieren (nur künftige Termine). */
  async function markFirstSaturdays() {
    const dates = future
      .filter((s) => s.date.slice(8) <= "07" && s.mode !== "familie")
      .map((s) => s.date);
    if (!dates.length) return toast.info("Keine passenden Termine.");
    const { error } = await (supabase as any)
      .from("pool_slots")
      .update({ mode: "familie" })
      .eq("pool", pool)
      .in("slot_date", dates);
    if (error) return toast.error(error.message);
    toast.success(`${dates.length} Termine als Familienschwimmen markiert`);
    await loadSlots();
  }

  /** Feste Nutzungszeit des Bades (z. B. Kurbad sonntags 12–14 Uhr) für einen Zeitraum als Plan vorschlagen. */
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

  /** Neuen Plan mit dem gespeicherten vergleichen; übernommen wird erst nach Bestätigung. */
  function stage(parsed: PoolSlot[], fileName: string) {
    {
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
    const up = await (supabase as any)
      .from("pool_slots")
      .upsert(rows, { onConflict: "pool,slot_date" });
    if (up.error) {
      setBusy(false);
      return toast.error(up.error.message);
    }
    if (pending.removed.length) {
      const rm = await (supabase as any)
        .from("pool_slots")
        .update({ closed: true, pdf_note: "nicht mehr im Plan", source_file: pending.file })
        .eq("pool", pool)
        .in("slot_date", pending.removed);
      if (rm.error) {
        setBusy(false);
        return toast.error(rm.error.message);
      }
    }
    // Bestehende Kurse, deren Termine auf geänderte oder entfallene Tage fallen.
    const affected = pending.diff.map((d) => d.date);
    let list: string[] = [];
    if (affected.length) {
      const { data } = await supabase
        .from("course_sessions")
        .select("session_date, start_time, courses(name, archived_at)")
        .in("session_date", affected);
      list = ((data ?? []) as any[])
        .filter((r) => !r.courses?.archived_at)
        .map((r) => {
          const d = pending.diff.find((x) => x.date === r.session_date)!;
          return `${fmt(r.session_date)}: ${r.courses?.name} – Bad jetzt ${d.now}`;
        });
    }
    setConflicts(list);
    setBusy(false);
    setPending(null);
    toast.success(`Plan übernommen (${pending.diff.length} Änderungen)`);
    await loadSlots();
  }

  async function createTerms() {
    const chosen = terms.filter(isSelected);
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
          max_participants: k.max,
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
      await onCreated();
      setToggled({});
    }
  }

  const usage = laneUsage(kinds, cfg.lanes);
  const need = trainersNeeded(kinds, cfg.lanes);

  /** Termine sperren, an denen selbst mit allen offenen Antworten zu wenige Trainer möglich sind. */
  async function blockUnderstaffed() {
    const dates = future
      .filter((s) => !s.closed && !skipReason(s) && s.mode !== "entfaellt")
      .filter((s) => {
        const st = staffing(s.date);
        return st.yes + st.unknown < need;
      })
      .map((s) => s.date);
    if (!dates.length) return toast.info("Alle Termine sind noch personell möglich.");
    const { error } = await (supabase as any)
      .from("pool_slots")
      .update({ mode: "entfaellt" })
      .eq("pool", pool)
      .in("slot_date", dates);
    if (error) return toast.error(error.message);
    toast.success(`${dates.length} Termine gesperrt (zu wenige Trainer)`);
    await loadSlots();
  }

  // Plätze je Kurs: eigene Eingabe, sonst vom letzten Zeitraum desselben Angebots.
  const maxFor = (k: Kind): number | null =>
    k.max ??
    courses
      .filter((c) => c.program_id === k.id && c.max_participants)
      .sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""))[0]?.max_participants ??
    null;
  const demandOf = (k: Kind) =>
    demandFor(k.id, future[Math.min(k.units, future.length) - 1]?.date ?? null);

  /** Kurse nach Nachfrage verteilen: Angebote mit vielen Wartenden zuerst, ohne Wartende keine Kurse. */
  function applyDemand() {
    if (!waiting) return toast.error("Die Warteliste konnte nicht gelesen werden.");
    const typicalSlot = future.find((s) => !s.closed);
    const blocks = typicalSlot
      ? Math.max(0, ...kinds.map((k) => blocksFit(typicalSlot, k.minutes, pause)))
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
  // Kurse, deren Zeitblock nicht in die übliche Badezeit passt, würden sonst ohne Hinweis fehlen.
  const typical = future.find((s) => !s.closed);
  const noFit = typical ? kinds.filter((k) => blocksFit(typical, k.minutes, pause) <= k.block) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1100px] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kurszeiträume aus dem Nutzungsplan vorschlagen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
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
              {p.name} ({p.dayName}s)
            </Button>
          ))}
        </div>

        {/* 1. Plan */}
        <section className="rounded-md border p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm">1. Nutzungsplan der Sportschule</div>
              <p className="text-xs text-muted-foreground">
                {slots.length
                  ? `${slots.length} Termine gespeichert (${short(slots[0].date)}${slots[0].date.slice(0, 4)} bis ${short(slots[slots.length - 1].date)}${slots[slots.length - 1].date.slice(0, 4)}). Ein neuer Plan überschreibt die Zeiten je Datum, deine Sperren bleiben erhalten.`
                  : "Noch kein Plan gespeichert. Plan der Sportschule hochladen (PDF, Excel, Word, CSV oder Text)."}
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
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <span className="text-xs text-muted-foreground w-full">
                {cfg.name}: feste Nutzungszeit {cfg.dayName}s {cfg.rule.start}–{cfg.rule.end} Uhr,
                nur das ganze Bad (keine parallelen Kurse). Zeitraum angeben, die Termine werden
                vorgeschlagen:
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

          {pending && (
            <div className="rounded-md bg-muted/40 p-3 space-y-2 text-sm">
              <div className="font-medium">
                {pending.file}: {pending.parsed.length} Termine erkannt,{" "}
                {pending.diff.length
                  ? `${pending.diff.length} Änderungen zum gespeicherten Plan`
                  : "keine Änderungen"}
              </div>
              {pending.diff.length > 0 && (
                <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {pending.diff.map((d) => (
                    <li key={d.date}>
                      <Badge variant="outline" className="mr-2">
                        {d.kind}
                      </Badge>
                      {fmt(d.date)}: {d.was} → {d.now}
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
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Bereits angelegte Kurse sind betroffen – bitte
                Termine prüfen und Eltern informieren:
              </div>
              {conflicts.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Termine & Sperren */}
        {slots.length > 0 && (
          <section className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">2. Termine sperren</div>
                <p className="text-xs text-muted-foreground">
                  Feiertage entfallen automatisch. Familienschwimmen oder andere Termine stellst du
                  je Datum um; die Auswahl wird gespeichert.
                </p>
              </div>
              {surveyed && (
                <Button size="sm" variant="outline" onClick={blockUnderstaffed}>
                  Termine ohne genug Trainer sperren
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={markFirstSaturdays}>
                Jeden 1. {cfg.dayName} im Monat = Familienschwimmen
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground text-left sticky top-0 bg-background">
                  <tr>
                    <th className="py-1">Datum</th>
                    <th>Zeit laut Plan</th>
                    <th>Hinweis</th>
                    <th>Trainer (Zusagen / offen)</th>
                    <th className="w-52">Nutzung</th>
                  </tr>
                </thead>
                <tbody>
                  {future.map((s) => {
                    const hol = holidayName(s.date);
                    const reason = skipReason(s);
                    return (
                      <tr
                        key={s.date}
                        className={`border-t ${s.closed || reason ? "bg-muted/40" : ""}`}
                      >
                        <td className="py-1 whitespace-nowrap">{fmt(s.date)}</td>
                        <td className="whitespace-nowrap">{time(s)}</td>
                        <td className="text-xs text-muted-foreground">
                          {[hol && `Feiertag: ${hol}`, s.note].filter(Boolean).join(" · ")}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {s.closed || reason || !surveyed
                            ? "—"
                            : (() => {
                                const st = staffing(s.date);
                                const color =
                                  st.yes + st.unknown < need
                                    ? "text-red-600 font-semibold"
                                    : st.yes < need
                                      ? "text-amber-700"
                                      : "text-emerald-700";
                                return (
                                  <span className={color}>
                                    {st.yes} / {st.unknown} (nötig {need})
                                  </span>
                                );
                              })()}
                        </td>
                        <td>
                          {s.closed ? (
                            <span className="text-xs">Bad geschlossen</span>
                          ) : (
                            <Select value={s.mode ?? "std"} onValueChange={(v) => setMode(s, v)}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(MODE_LABEL).map(([v, l]) => (
                                  <SelectItem key={v} value={v}>
                                    {v === "std" && hol ? "Standard (entfällt)" : l}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. Kursarten */}
        {slots.length > 0 && (
          <section className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-sm">3. Kurse pro {cfg.dayName}</div>
              <Button size="sm" variant="outline" onClick={applyDemand}>
                Nach Nachfrage (Warteliste) vorschlagen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Das Bad stellt {cfg.lanes} Bahnen. Kurse im selben Zeitblock laufen gleichzeitig; ein
              weiterer Block beginnt, sobald der vorige zu Ende ist. Passen weniger Blöcke in die
              Badezeit eines Tages, entfällt der Termin für den Kurs im letzten Block.
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground text-left">
                <tr>
                  <th>Kursangebot</th>
                  <th>Wartende</th>
                  <th>Bahnen</th>
                  <th>Minuten</th>
                  <th>Einheiten</th>
                  <th>parallel</th>
                  <th>Zeitblock</th>
                  <th>Plätze</th>
                  <th>Trainer</th>
                </tr>
              </thead>
              <tbody>
                {kinds.map((k) => {
                  const set = (patch: Partial<Kind>) =>
                    setKinds((all) => all.map((x) => (x.id === k.id ? { ...x, ...patch } : x)));
                  const num = (v: string, min = 1) => Math.max(min, Number(v) || min);
                  return (
                    <tr key={k.id} className="border-t">
                      <td className="py-1 pr-2">{programName(k.id)}</td>
                      <td className="pr-2 whitespace-nowrap text-xs">
                        {waiting === null
                          ? "—"
                          : `${demandOf(k)}${maxFor(k) ? ` (≈ ${(demandOf(k) / maxFor(k)!).toFixed(1)} Kurse)` : ""}`}
                      </td>
                      <td>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={k.lanes}
                          onChange={(e) => set({ lanes: Math.min(cfg.lanes, num(e.target.value)) })}
                        />
                      </td>
                      <td>
                        <Input
                          className="h-8 w-20"
                          type="number"
                          value={k.minutes}
                          onChange={(e) => set({ minutes: num(e.target.value, 15) })}
                        />
                      </td>
                      <td>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={k.units}
                          onChange={(e) => set({ units: Math.min(30, num(e.target.value)) })}
                        />
                      </td>
                      <td>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={k.count}
                          onChange={(e) => set({ count: num(e.target.value, 0) })}
                        />
                      </td>
                      <td>
                        <Select
                          value={String(k.block)}
                          onValueChange={(v) => set({ block: Number(v) })}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2].map((b) => (
                              <SelectItem key={b} value={String(b)}>
                                Block {b + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={k.max ?? ""}
                          onChange={(e) =>
                            set({ max: e.target.value ? Number(e.target.value) : null })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          className="h-8 w-16"
                          type="number"
                          value={k.trainers}
                          onChange={(e) =>
                            set({
                              trainers: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {poolPrograms.some((p) => !kinds.some((k) => k.id === p.id)) && (
              <Select
                value=""
                onValueChange={(id) =>
                  setKinds((all) => [
                    ...all,
                    {
                      id,
                      lanes: Math.min(cfg.lanes, /aufbau/i.test(programName(id)) ? 2 : 1),
                      minutes: 45,
                      units: 10,
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
                  {poolPrograms
                    .filter((p) => !kinds.some((k) => k.id === p.id))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {Object.entries(usage).map(([b, n]) => (
                <span
                  key={b}
                  className={n > cfg.lanes ? "text-red-600 font-semibold" : "text-muted-foreground"}
                >
                  Block {Number(b) + 1}: {n}/{cfg.lanes} Bahnen
                  {n > cfg.lanes ? " – zu viele!" : ""}
                </span>
              ))}
              {noFit.map((k) => (
                <span key={k.id} className="text-red-600 font-semibold">
                  {programName(k.id)}: Block {k.block + 1} passt nicht in die Badezeit (
                  {time(typical)}) – kein Vorschlag
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
        )}

        {/* 4. Vorschlag */}
        {slots.length > 0 && (
          <section className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">4. Vorschlag</div>
              <Button disabled={busy || !terms.length} onClick={createTerms}>
                <CalendarPlus className="h-4 w-4" /> Ausgewählte anlegen
              </Button>
            </div>
            {loading && <p className="text-xs text-muted-foreground">Lade…</p>}
            {!terms.length && !loading && (
              <p className="text-sm text-muted-foreground">
                Mit diesen Einstellungen ist kein Zeitraum möglich.
              </p>
            )}
            <div className="space-y-1">
              {terms.map((t) => {
                const ov = overlap(t);
                const first = t.sessions[0];
                const last = t.sessions[t.sessions.length - 1];
                return (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 rounded border p-2 text-sm cursor-pointer"
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
                        {kinds.find((k) => k.id === t.track.kindId)!.count > 1
                          ? ` ${t.track.copy}`
                          : ""}{" "}
                        <span className="font-normal">
                          · {fmt(first.date)} bis {fmt(last.date)} · {t.sessions.length} Termine ·{" "}
                          {first.start}–{first.end} Uhr
                        </span>
                      </div>
                      {t.sessions.some((s) => s.start !== first.start) && (
                        <div className="text-xs text-muted-foreground">
                          Abweichende Zeiten:{" "}
                          {t.sessions
                            .filter((s) => s.start !== first.start)
                            .map((s) => `${short(s.date)} ${s.start}`)
                            .join(", ")}
                        </div>
                      )}
                      {t.breaks.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Pausen: {t.breaks.map((b) => `${short(b.date)} ${b.note}`).join(", ")}
                        </div>
                      )}
                      {!t.complete && (
                        <div className="text-xs text-amber-700">
                          Nur {t.sessions.length} von{" "}
                          {kinds.find((k) => k.id === t.track.kindId)!.units} Terminen –
                          Vertragsende erreicht.
                        </div>
                      )}
                      {waiting !== null && terms.find((x) => x.track.id === t.track.id) === t && (
                        <div className="text-xs text-emerald-700">
                          Warteliste: {demandFor(t.track.kindId, first.date)} Kinder warten auf
                          dieses Angebot
                        </div>
                      )}
                      {surveyed && thin(t).length > 0 && (
                        <div className="text-xs text-amber-700">
                          Zu wenige Trainer-Zusagen (je Termin {need} nötig):{" "}
                          {thin(t)
                            .map((d) => `${short(d)} ${staffing(d).yes}/${need}`)
                            .join(", ")}
                        </div>
                      )}
                      {ov && (
                        <div className="text-xs text-red-600">
                          Überschneidet bestehenden Zeitraum: {ov}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Angelegt werden die Zeiträume mit Status „Geplant“; Preise, Beschreibung und
              Kursangaben kommen aus dem Kursangebot. Einzelne Termine, Trainer und Texte änderst du
              danach wie gewohnt im Zeitraum.
            </p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
