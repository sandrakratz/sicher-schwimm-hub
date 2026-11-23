import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { slugify, type Course } from "@/components/admin/kurse/shared";
import { supabase } from "@/integrations/supabase/client";
import { blackoutOn } from "@/lib/dienstplan";
import {
  adjustKey,
  autoBlocks,
  blocksFit,
  laneUsage,
  planTerms,
  suggestByDemand,
  trainersNeeded,
  type Adjustments,
  type PlannedTerm,
} from "@/lib/pool-schedule";
import type { PoolData } from "./usePoolData";
import {
  NOTICE,
  overlaps,
  remarkOf,
  short,
  skipReason,
  toMin,
  wd,
  type Entry,
  type Kind,
  type PoolConfig,
  type Staffing,
} from "./utils";

/**
 * Planungsmodell eines Bades: Kursarten-Einstellungen, daraus berechnete Kurszeiträume,
 * Trainerlage je Termin, Auswahl und Anlegen der Kurszeiträume.
 */
export function usePlanning(cfg: PoolConfig, data: PoolData) {
  const { programs, courses, slots, taken, crewOn, team, availRows, blackouts, waiting, today } =
    data;
  const pool = cfg.id;
  const [kinds, setKindsRaw] = useState<Kind[]>([]);
  const [kindsPool, setKindsPool] = useState("");
  const [adjust, setAdjust] = useState<Adjustments>({});
  const [noticeOn, setNoticeOn] = useState<Record<string, boolean>>({});
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Jede Änderung an den Einstellungen verwirft die Handauswahl der Vorschläge. */
  const setKinds = (next: (all: Kind[]) => Kind[]) => {
    setKindsRaw(next);
    setToggled({});
  };

  // ---------- Kursangebote ----------

  const poolPrograms = useMemo(() => {
    const hit = programs.filter((p) => cfg.match.test(`${p.location ?? ""} ${p.name}`));
    return hit.length ? hit : programs;
  }, [programs, cfg]);
  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? "Kurs";

  const latest = (programId: string, pick: (c: Course) => number | null | undefined) =>
    courses
      .filter((c) => c.program_id === programId && pick(c))
      .sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""))[0];
  const maxFor = (k: Kind): number | null =>
    k.max ?? latest(k.id, (c) => c.max_participants)?.max_participants ?? null;

  // Standard: 1 Bahn (Aufbaukurs 2), 45 Minuten, Einheiten und Trainer wie beim letzten Kurs (sonst 10 bzw. 2).
  const defaultKind = (id: string): Kind => ({
    id,
    lanes: Math.min(cfg.lanes, /aufbau/i.test(programName(id)) ? 2 : 1),
    minutes: 45,
    units: Math.min(30, latest(id, (c) => c.unit_count)?.unit_count ?? 10),
    trainers: latest(id, (c) => c.trainers_needed)?.trainers_needed ?? 2,
    count: 1,
    block: 0,
    max: null,
    from: null,
  });

  // Beim ersten Laden bzw. Wechsel des Bades: zuletzt verwendete Einstellungen dieses Bades
  // (soweit die Kursangebote noch existieren), sonst Seepferdchen, Bronze und Aufbaukurs.
  if (kindsPool !== pool && programs.length) {
    setKindsPool(pool);
    let saved: { kinds?: Kind[] } = {};
    try {
      saved = JSON.parse(localStorage.getItem(`kursplanung-${pool}`) ?? "{}");
    } catch {
      /* ohne gespeicherte Werte starten */
    }
    const keep = (saved.kinds ?? []).filter((k) => programs.some((p) => p.id === k.id));
    const base = poolPrograms
      .filter((p) => /seepferd|bronze|aufbau/i.test(p.name))
      .map((p) => defaultKind(p.id));
    const blocks = autoBlocks(base, cfg.lanes);
    setKindsRaw(keep.length ? keep : base.map((k) => ({ ...k, block: blocks[k.id] })));
  }

  // Einstellungen je Bad merken (nur in diesem Browser).
  useEffect(() => {
    if (kindsPool !== pool) return;
    try {
      localStorage.setItem(`kursplanung-${pool}`, JSON.stringify({ kinds }));
    } catch {
      /* nicht schlimm */
    }
  }, [kinds, pool, kindsPool]);

  /** Angebote, die in der Liste stehen: die zum Bad passenden plus alles, was schon geplant ist. */
  const kindRows = programs.filter(
    (p) => poolPrograms.some((x) => x.id === p.id) || kinds.some((k) => k.id === p.id),
  );

  // ---------- Termine und Vorschläge ----------

  const future = useMemo(() => slots.filter((s) => s.date >= today), [slots, today]);
  const terms = useMemo(() => {
    const skip: Record<string, string> = {};
    for (const s of future) {
      const r = skipReason(s);
      if (r) skip[s.date] = r;
    }
    return planTerms(future, skip, kinds, cfg.lanes, taken, adjust);
  }, [future, kinds, cfg.lanes, taken, adjust]);

  const trainersOf = (kindId: string) => kinds.find((k) => k.id === kindId)?.trainers ?? 2;
  const need = trainersNeeded(kinds, cfg.lanes);
  const surveyed = availRows.length > 0;

  /**
   * Zusagen, Absagen und offene Antworten für einen Termin. Mit Zeitfenster (von/bis) zählen
   * Trainer, die in dieser Zeit schon in einem anderen Kurs eingeteilt sind, als „busy“ und nicht als frei.
   */
  function staffing(date: string, from?: string, to?: string): Staffing {
    const st: Staffing = { yes: 0, no: 0, unknown: 0, busy: 0 };
    const occupied = new Set<string>();
    if (from && to)
      for (const c of crewOn[date] ?? [])
        if (overlaps(c.start, c.end, toMin(from), toMin(to)))
          for (const id of c.ids) occupied.add(id);
    for (const m of team) {
      const a = availRows.find((r) => r.d === date && r.t === m.id);
      if (occupied.has(m.id)) st.busy++;
      else if (blackoutOn(blackouts, m.id, date) || a?.ok === false) st.no++;
      else if (a?.ok) st.yes++;
      else st.unknown++;
    }
    return st;
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

  // Trainerbedarf zur selben Zeit: alle Vorschläge, die an diesem Tag überlappen (ohne die abgewählten).
  const needAt = (date: string, from: string, to: string) =>
    terms
      .filter((x) => toggled[x.id] !== false)
      .filter((x) =>
        x.sessions.some((s) => s.date === date && overlaps(s.start, s.end, toMin(from), toMin(to))),
      )
      .reduce((n, x) => n + trainersOf(x.track.kindId), 0);

  /**
   * Termine eines Vorschlags, an denen die Trainer nicht reichen: „hart“, wenn selbst mit allen offenen
   * Antworten zu wenige frei sind (bereits eingeteilte Trainer zählen nicht), sonst nur zu wenige Zusagen.
   */
  const staffGaps = (t: PlannedTerm) => {
    if (!team.length) return [];
    const own = trainersOf(t.track.kindId);
    return t.sessions
      .map((s) => {
        const st = staffing(s.date, s.start, s.end);
        const req = Math.max(own, needAt(s.date, s.start, s.end));
        return { date: s.date, st, req, hard: st.yes + st.unknown < req };
      })
      .filter((c) => c.hard || (surveyed && c.st.yes < c.req));
  };
  const isSelected = (t: PlannedTerm) =>
    toggled[t.id] ?? (t.complete && !overlap(t) && staffGaps(t).length === 0);
  const chosen = terms.filter(isSelected);

  // Hinweis „Uhrzeit kann sich ändern“: Termine, für die der Badplan eine Bemerkung enthält.
  const slotNote = useMemo(() => new Map(slots.map((x) => [x.date, remarkOf(x.note)])), [slots]);
  const noticeDates = (t: PlannedTerm) =>
    t.sessions.filter((x) => slotNote.get(x.date)).map((x) => x.date);
  const hasNotice = (t: PlannedTerm) =>
    noticeOn[t.id] ?? (cfg.id === "sportschule" && noticeDates(t).length > 0);
  const noticeText = (t: PlannedTerm) => {
    const d = noticeDates(t);
    return `${NOTICE}${d.length ? ` (betrifft: ${d.map(short).join(", ")})` : ""}.`;
  };

  // Bereits vergebene und vorgeschlagene Kurse je Termin.
  const entriesOn: Record<string, Entry[]> = {};
  for (const [d, list] of Object.entries(taken))
    for (const t of list)
      (entriesOn[d] ??= []).push({
        start: t.start,
        end: t.end,
        label: t.name,
        isNew: false,
        noTime: t.noTime,
      });
  for (const t of chosen)
    for (const s of t.sessions)
      (entriesOn[s.date] ??= []).push({
        start: s.start,
        end: s.end,
        label: programName(t.track.kindId),
        isNew: true,
      });

  // ---------- Badzeit und Kapazität ----------

  const typical = future.find((s) => !s.closed && s.start);
  const nBlocks = Math.min(
    4,
    Math.max(1, typical ? blocksFit(typical, kinds[0]?.minutes ?? 45) : 2),
  );
  // Wie viele Kurse einer Art pro Tag in die Badezeit passen (ab ihrem Zeitblock, nebeneinander oder nacheinander).
  const noFit = kinds
    .filter((k) => k.count > 0)
    .map((k) => {
      const perBlock = Math.max(1, Math.floor(cfg.lanes / k.lanes));
      const blocksLeft = typical ? Math.max(0, blocksFit(typical, k.minutes) - k.block) : 0;
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

  // ---------- Änderungen ----------

  /** Kurs in die Planung aufnehmen oder herausnehmen; neue Kurse bekommen die erste freie Stunde. */
  function toggleKind(id: string, on: boolean) {
    setKinds((all) => {
      const has = all.some((x) => x.id === id);
      const next = has
        ? all.map((x) => (x.id === id ? { ...x, count: on ? Math.max(1, x.count) : 0 } : x))
        : on
          ? [...all, defaultKind(id)]
          : all;
      if (!on) return next;
      const placed = autoBlocks(next, cfg.lanes);
      return next.map((x) => (x.id === id && !has ? { ...x, block: placed[id] ?? 0 } : x));
    });
  }

  const patchKind = (id: string, patch: Partial<Kind>) =>
    setKinds((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  /** Kursanzahl nach Warteliste verteilen und Zeitblöcke neu setzen. */
  function applyDemand() {
    if (!waiting) return toast.error("Die Warteliste konnte nicht gelesen werden.");
    const blocks = typical ? Math.max(0, ...kinds.map((k) => blocksFit(typical, k.minutes))) : 0;
    const counts = suggestByDemand(
      kinds.map((k) => ({ id: k.id, lanes: k.lanes, demand: demandOf(k), max: maxFor(k) })),
      cfg.lanes,
      blocks,
    );
    setKinds((all) => {
      const next = all.map((k) => ({ ...k, count: counts[k.id] ?? 0 }));
      const placed = autoBlocks(next, cfg.lanes);
      return next.map((k) => ({ ...k, block: placed[k.id] }));
    });
    toast.success("Vorschlag nach Nachfrage erstellt – bitte prüfen und anpassen.");
  }

  /** Einzelnen Termin eines Vorschlags anpassen (auslassen / andere Startzeit); undefined/false nimmt es zurück. */
  function setAdj(trackId: string, date: string, patch: { skip?: boolean; start?: string }) {
    setAdjust((all) => {
      const key = adjustKey(trackId, date);
      const cur = { ...all[key], ...patch };
      const next = { ...all };
      if (!cur.skip && !cur.start) delete next[key];
      else next[key] = { skip: cur.skip || undefined, start: cur.start };
      return next;
    });
    setToggled({});
  }

  /** Handarbeit am Vorschlag verwerfen (nach Badwechsel oder Anlegen). */
  function resetChoices({ adjustments }: { adjustments: boolean }) {
    setToggled({});
    setNoticeOn({});
    if (adjustments) setAdjust({});
  }

  /** Ausgewählte Kurszeiträume als geplante Kurse mit Terminen anlegen. */
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
          is_public: publish,
          price_member: p.price_member,
          price_non_member: p.price_non_member,
          payment_due_days: p.payment_due_days,
          program_id: p.id,
          unit_count: t.sessions.length,
          course_info: p.course_info,
          lanes: k.lanes,
          trainers_needed: k.trainers,
          session_breaks: t.breaks,
          time_notice: hasNotice(t) ? noticeText(t) : null,
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
      resetChoices({ adjustments: false });
      await Promise.all([data.loadBase(), data.loadTaken()]);
    }
  }

  return {
    cfg,
    data,
    publish,
    setPublish,
    busy,
    createTerms,
    applyDemand,
    kinds,
    kindRows,
    adjust,
    setAdjust,
    setToggled,
    setNoticeOn,
    programName,
    maxFor,
    future,
    terms,
    chosen,
    need,
    surveyed,
    staffing,
    overlap,
    staffGaps,
    isSelected,
    noticeDates,
    hasNotice,
    noticeText,
    entriesOn,
    typical,
    nBlocks,
    noFit,
    usage,
    waiting,
    demandFor,
    demandOf,
    toggleKind,
    patchKind,
    setAdj,
    resetChoices,
  };
}

export type Planning = ReturnType<typeof usePlanning>;
