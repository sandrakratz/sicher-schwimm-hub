// Helfer-Umfrage zu Terminen: Abdeckung und Lücken berechnen (Europe/Berlin).

export type ShiftSignup = {
  id: string;
  event_id: string;
  trainer_id: string;
  available: boolean;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
};

export type Interval = { start: number; end: number };

/** Berliner Datums-/Zeitteile eines ISO-Zeitstempels. */
export function berlinParts(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => { acc[x.type] = x.value; return acc; }, {});
  const hour = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}

/** "14:30" in Berliner Zeit für einen Zeitstempel. */
export function berlinTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return berlinParts(iso)?.time ?? "";
}

/** Wert für ein <input type="datetime-local"> in Berliner Zeit. */
export function toBerlinInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = berlinParts(iso);
  return p ? `${p.date}T${p.time}` : "";
}

/** Berliner Eingabe ("2026-09-01T14:30") -> ISO-Zeitstempel. */
export function fromBerlinInput(value: string): string | null {
  if (!value) return null;
  const naive = Date.parse(`${value}:00Z`);
  if (isNaN(naive)) return null;
  const probe = new Date(naive);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
    .formatToParts(probe)
    .reduce<Record<string, string>>((acc, x) => { acc[x.type] = x.value; return acc; }, {});
  const hour = p.hour === "24" ? "00" : p.hour;
  const asUtc = Date.parse(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`);
  return new Date(naive - (asUtc - naive)).toISOString();
}

/** Zeitfenster einer Zusage, begrenzt auf den Terminzeitraum. */
export function signupInterval(
  s: ShiftSignup,
  eventStart: number,
  eventEnd: number,
): Interval | null {
  if (!s.available) return null;
  const start = s.starts_at ? Date.parse(s.starts_at) : eventStart;
  const end = s.ends_at ? Date.parse(s.ends_at) : eventEnd;
  if (isNaN(start) || isNaN(end)) return null;
  const a = Math.max(start, eventStart);
  const b = Math.min(end, eventEnd);
  return b > a ? { start: a, end: b } : null;
}

/** Nicht besetzte Abschnitte innerhalb des Terminzeitraums. */
export function coverageGaps(intervals: Interval[], eventStart: number, eventEnd: number): Interval[] {
  if (eventEnd <= eventStart) return [];
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const gaps: Interval[] = [];
  let cursor = eventStart;
  for (const iv of sorted) {
    if (iv.start > cursor) gaps.push({ start: cursor, end: Math.min(iv.start, eventEnd) });
    cursor = Math.max(cursor, iv.end);
    if (cursor >= eventEnd) break;
  }
  if (cursor < eventEnd) gaps.push({ start: cursor, end: eventEnd });
  return gaps.filter(g => g.end > g.start);
}

/** Belegung je Zeitscheibe (Standard: 30 Minuten) für die Zeitleiste. */
export function coverageSlices(
  intervals: Interval[],
  eventStart: number,
  eventEnd: number,
  stepMinutes = 30,
): { start: number; end: number; count: number }[] {
  const step = stepMinutes * 60_000;
  const out: { start: number; end: number; count: number }[] = [];
  if (eventEnd <= eventStart) return out;
  for (let t = eventStart; t < eventEnd; t += step) {
    const end = Math.min(t + step, eventEnd);
    out.push({ start: t, end, count: intervals.filter(iv => iv.start < end && iv.end > t).length });
  }
  return out;
}

export function formatRange(start: number, end: number): string {
  return `${berlinTime(new Date(start).toISOString())}–${berlinTime(new Date(end).toISOString())}`;
}
