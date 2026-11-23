import { formatDateBerlin, formatMonthYear } from "@/lib/format";
import {
  fromMin,
  holidayName,
  toMin,
  type KindSetting,
  type POOLS,
  type PoolSlot,
} from "@/lib/pool-schedule";

export { toMin, fromMin as hhmm };

export type PoolConfig = (typeof POOLS)[number];
export type Mode = "open" | "familie" | "entfaellt" | null;
export type StoredSlot = PoolSlot & { mode: Mode };
export type Kind = KindSetting & { max: number | null };
export type Diff = {
  date: string;
  kind: "neu" | "geändert" | "entfällt";
  was: string;
  now: string;
};
export type Pending = { file: string; parsed: PoolSlot[]; diff: Diff[]; removed: string[] };
export type Entry = { start: string; end: string; label: string; isNew: boolean; noTime?: boolean };
/** Bereits angelegter Kurs an einem Badtermin samt eingeteilten Trainern. */
export type Crew = { name: string; ids: string[]; needed: number; start: string; end: string };
export type Staffing = { yes: number; no: number; unknown: number; busy: number };

export const wd = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
/** „Sa 05.12.2026“ */
export const fmt = (d: string) => `${wd(d)} ${formatDateBerlin(d)}`;
/** „05.12.“ */
export const short = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;
export const monthLabel = formatMonthYear;
export const time = (s: PoolSlot | undefined) =>
  !s ? "—" : s.closed || !s.start ? "geschlossen" : `${s.start}–${s.end}`;
/** Überschneidet sich start–end (HH:MM) mit dem Zeitfenster from–to (Minuten)? */
export const overlaps = (start: string, end: string, from: number, to: number) =>
  toMin(start) < to && toMin(end) > from;

// Bemerkungen, die der Plan-Leser selbst erzeugt, sind keine Hinweise des Bades.
const AUTO_NOTE = /^(Jahr im PDF|anderer Wochentag|keine Uhrzeit)|bitte im PDF prüfen/i;
export const remarkOf = (n: string | null) =>
  (n ?? "")
    .split(" · ")
    .filter((x) => x && !AUTO_NOTE.test(x))
    .join(" · ");
export const NOTICE =
  "Hinweis: Bis zu 5 Tage vorher ist eine Änderung der Uhrzeit aufgrund von Terminen in der Sportschule möglich";

export const MODE_LABEL: Record<string, string> = {
  std: "Normal",
  open: "Kurs findet statt",
  familie: "Mitgliederschwimmen",
  entfaellt: "Entfällt",
};

/** Zeile aus `pool_slots` (fehlt noch in types.ts). */
export function toStored(r: any): StoredSlot {
  return {
    date: r.slot_date,
    start: r.start_time ? String(r.start_time).slice(0, 5) : null,
    end: r.end_time ? String(r.end_time).slice(0, 5) : null,
    closed: !!r.closed,
    note: r.pdf_note ?? null,
    mode: (r.mode as Mode) ?? null,
  };
}

/** Warum an diesem Badtermin kein Kurs geplant wird (Festlegung oder Feiertag). */
export function skipReason(s: StoredSlot): string | undefined {
  if (s.mode === "familie") return "Mitgliederschwimmen";
  if (s.mode === "entfaellt") return "Termin entfällt";
  if (s.mode === "open") return undefined;
  const h = holidayName(s.date);
  return h ? `Feiertag (${h})` : undefined;
}

/** Vergleich eines neuen Badplans mit den gespeicherten Terminen. */
export function diffPlan(slots: StoredSlot[], parsed: PoolSlot[], file: string): Pending {
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
  return { file, parsed, diff, removed };
}

/** Badtermine aus der festen Nutzungszeit des Bades für einen Zeitraum. */
export function ruleSlots(
  cfg: PoolConfig,
  rule: { start: string; end: string },
  from: string,
  to: string,
): PoolSlot[] {
  const out: PoolSlot[] = [];
  for (
    let d = new Date(`${from}T12:00:00Z`);
    d <= new Date(`${to}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if (d.getUTCDay() !== cfg.weekday) continue;
    out.push({
      date: d.toISOString().slice(0, 10),
      start: rule.start,
      end: rule.end,
      closed: false,
      note: null,
    });
  }
  return out;
}
