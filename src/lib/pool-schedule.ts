/**
 * Kursplanung aus dem Nutzungsvertrag des Hallenbads: liest die Nutzungstermine (Anlage 1),
 * erkennt Feiertage und verteilt Kurse auf die Zeitblöcke und Bahnen jedes Termins.
 */

export type PoolSlot = {
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  /** Hallenbad an diesem Tag nicht nutzbar (keine Zeit im PDF, „geschlossen“, „keine Nutzung“). */
  closed: boolean;
  /** Bemerkung aus dem PDF bzw. Hinweis zur Erkennung. */
  note: string | null;
};

const pad = (n: number | string) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Zeilen aus dem PDF (eine Tabellenzeile pro Eintrag) → Nutzungstermine. */
export function parsePoolSlots(lines: string[], weekday?: number): PoolSlot[] {
  const out: PoolSlot[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    // Nur Zeilen, die mit dem Datum beginnen (optional Wochentag davor): Datumsangaben im Vertragstext zählen nicht.
    const m = line.match(
      /^(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)[a-z]*\.?,?\s+)?(\d{1,2})\.(\d{1,2})\.(\d{4})(.*)$/,
    );
    if (!m) continue;
    let year = Number(m[3]);
    const month = Number(m[2]);
    const day = Number(m[1]);
    let date = iso(year, month, day);
    let note: string | null = null;
    // Die Liste ist chronologisch; ein Datum vor dem Vorgänger ist ein Tippfehler im Jahr (z. B. 02.01.2026).
    const prev = out[out.length - 1];
    if (prev && date < prev.date) {
      year += 1;
      date = iso(year, month, day);
      note = `Jahr im PDF ${m[3]}, als ${year} gelesen`;
    }
    const rest = m[4].trim();
    // Trennzeichen optional: Excel-Tabellen liefern „Von“ und „Bis“ in getrennten Zellen.
    const t = rest.match(/(\d{1,2})[.:](\d{2})\s*(?:[-–]|bis)?\s*(\d{1,2})[.:](\d{2})/);
    const remark =
      rest
        .replace(/(\d{1,2})[.:](\d{2})\s*(?:[-–]|bis)?\s*(\d{1,2})[.:](\d{2})\s*(Uhr)?/, "")
        .trim() || null;
    const closedWord = remark && /geschlossen|keine nutzung/i.test(remark);
    const slot: PoolSlot = {
      date,
      start: t ? `${pad(t[1])}:${t[2]}` : null,
      end: t ? `${pad(t[3])}:${t[4]}` : null,
      closed: !t,
      note: [note, remark].filter(Boolean).join(" · ") || null,
    };
    if (!t && !remark) slot.note = [note, "keine Uhrzeit im PDF"].filter(Boolean).join(" · ");
    // „Keine Nutzung“ in einer Zeile mit Uhrzeit kann eine verrutschte Nachbarzeile sein: nicht sperren, aber melden.
    if (t && closedWord) slot.note = `${slot.note} – bitte im PDF prüfen`;
    if (weekday !== undefined && new Date(`${date}T12:00:00Z`).getUTCDay() !== weekday)
      slot.note = [slot.note, "anderer Wochentag als üblich"].filter(Boolean).join(" · ");
    out.push(slot);
  }
  // Ein Datum nur einmal (die Datenbank lehnt doppelte ab); bei Doppelungen gewinnt der Eintrag mit Uhrzeit.
  const byDate = new Map<string, PoolSlot>();
  for (const s of out) {
    const prev = byDate.get(s.date);
    if (!prev || (prev.closed && !s.closed)) byDate.set(s.date, s);
  }
  return [...byDate.values()];
}

/** Ostersonntag (Gregorianischer Kalender). */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Gesetzliche Feiertage in Nordrhein-Westfalen. */
export function nrwHolidays(year: number): Record<string, string> {
  const e = easter(year);
  return {
    [iso(year, 1, 1)]: "Neujahr",
    [addDays(e, -2)]: "Karfreitag",
    [addDays(e, 1)]: "Ostermontag",
    [iso(year, 5, 1)]: "Tag der Arbeit",
    [addDays(e, 39)]: "Christi Himmelfahrt",
    [addDays(e, 50)]: "Pfingstmontag",
    [addDays(e, 60)]: "Fronleichnam",
    [e]: "Ostersonntag",
    [addDays(e, 49)]: "Pfingstsonntag",
    [iso(year, 10, 3)]: "Tag der Deutschen Einheit",
    [iso(year, 11, 1)]: "Allerheiligen",
    [iso(year, 12, 25)]: "1. Weihnachtstag",
    [iso(year, 12, 26)]: "2. Weihnachtstag",
  };
}

export function holidayName(date: string): string | null {
  return nrwHolidays(Number(date.slice(0, 4)))[date] ?? null;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export type Track = {
  id: string;
  /** Verweis auf die Kursart (Zeile der Einstellungen). */
  kindId: string;
  /** Laufende Nummer, wenn eine Kursart mehrfach parallel läuft. */
  copy: number;
  /** Zeitblock innerhalb des Termins, 0 = erster. */
  block: number;
};

export type KindSetting = {
  id: string;
  lanes: number;
  /** Dauer einer Einheit in Minuten. */
  minutes: number;
  /** Einheiten je Kurszeitraum. */
  units: number;
  /** Wie oft die Kursart parallel angeboten wird. */
  count: number;
  /** Gewünschter Zeitblock, 0 = erster. */
  block: number;
  /** Trainer:innen, die ein Kurs dieser Art je Termin braucht. */
  trainers: number;
};

export const POOLS = [
  {
    id: "sportschule",
    name: "Sportschule Hennef",
    weekday: 6,
    dayName: "Samstag",
    lanes: 2,
    /** Feste Nutzungszeit, falls es keinen Plan als Datei gibt. */
    rule: null as { start: string; end: string } | null,
    match: /sportschule/i,
  },
  {
    id: "kurbad",
    name: "Kurbad",
    weekday: 0,
    dayName: "Sonntag",
    // Das Kurbad wird nur als Ganzes genutzt: ein Kurs zur Zeit, keine parallelen Kurse.
    lanes: 1,
    rule: { start: "12:00", end: "14:00" } as { start: string; end: string } | null,
    match: /kur(bad|haus)/i,
  },
];

/** Anzahl Zeitblöcke, die in einen Termin passen. */
export function blocksFit(slot: PoolSlot, minutes: number, pause: number): number {
  if (!slot.start || !slot.end || minutes <= 0) return 0;
  const len = toMin(slot.end) - toMin(slot.start);
  return Math.max(0, Math.floor((len + pause) / (minutes + pause)));
}

/** Belegte Bahnen je Zeitblock (für die Kapazitätsanzeige). */
export function laneUsage(kinds: KindSetting[], poolLanes: number): Record<number, number> {
  const use: Record<number, number> = {};
  for (const k of kinds)
    for (let c = 1; c <= k.count; c++) {
      const b = copyBlock(k, c, poolLanes);
      use[b] = (use[b] ?? 0) + k.lanes;
    }
  return use;
}

/** Zeitblock einer parallelen Kopie: passen nicht alle nebeneinander ins Bad, folgt sie im nächsten Block. */
function copyBlock(k: Pick<KindSetting, "lanes" | "block">, copy: number, poolLanes: number) {
  const perBlock = Math.max(1, Math.floor(poolLanes / k.lanes));
  return k.block + Math.floor((copy - 1) / perBlock);
}

/** Schlägt Zeitblöcke vor: breite Kurse allein, schmale paarweise. Beachtet die Bahnzahl des Bads. */
/** Trainer:innen, die an einem Termin gleichzeitig gebraucht werden (der größte Zeitblock zählt, da sich Blöcke nacheinander abwechseln). */
export function trainersNeeded(kinds: KindSetting[], poolLanes: number): number {
  const perBlock: Record<number, number> = {};
  for (const k of kinds)
    for (let c = 1; c <= k.count; c++) {
      const b = copyBlock(k, c, poolLanes);
      perBlock[b] = (perBlock[b] ?? 0) + k.trainers;
    }
  return Math.max(0, ...Object.values(perBlock));
}

export function autoBlocks(
  kinds: Omit<KindSetting, "block">[],
  poolLanes: number,
): Record<string, number> {
  const free: number[] = []; // freie Bahnen je Block
  const res: Record<string, number> = {};
  const order = kinds.filter((k) => k.count > 0).sort((a, b) => b.lanes - a.lanes);
  for (const k of kinds) res[k.id] = 0;
  for (const k of order) {
    const perBlock = Math.max(1, Math.floor(poolLanes / k.lanes));
    // Bedarf je Block, beginnend im ersten Block der Kursart.
    const need: number[] = [];
    for (let left = k.count; left > 0; left -= perBlock)
      need.push(Math.min(left, perBlock) * k.lanes);
    let b = 0;
    while (need.some((n, i) => (free[b + i] ?? poolLanes) < n)) b++;
    need.forEach((n, i) => {
      free[b + i] = (free[b + i] ?? poolLanes) - n;
    });
    res[k.id] = b;
  }
  return res;
}

export type DemandItem = {
  id: string;
  lanes: number;
  /** Wartende Kinder für dieses Kursangebot. */
  demand: number;
  /** Plätze je Kurs, wenn bekannt. */
  max: number | null;
};

/**
 * Verteilt die verfügbaren Bahn-Blöcke nach Nachfrage: erst ein Kurs für jedes Angebot mit Wartenden
 * (größte Nachfrage zuerst), dann zusätzliche Kurse, solange noch Wartende ohne Platz bleiben.
 * `blocks` = Zeitblöcke pro Termin, ein Block bietet `poolLanes` Bahnen.
 */
export function suggestByDemand(
  items: DemandItem[],
  poolLanes: number,
  blocks: number,
): Record<string, number> {
  const count: Record<string, number> = {};
  for (const i of items) count[i.id] = 0;
  let free = blocks * poolLanes;
  const wanted = items.filter((i) => i.demand > 0).sort((a, b) => b.demand - a.demand);
  for (const i of wanted) {
    if (free >= i.lanes) {
      count[i.id] = 1;
      free -= i.lanes;
    }
  }
  for (;;) {
    const open = wanted
      .filter((i) => count[i.id] > 0 && i.max && i.lanes <= free)
      .map((i) => ({ i, rest: i.demand - count[i.id] * i.max! }))
      .filter((x) => x.rest > 0)
      .sort((a, b) => b.rest - a.rest)[0];
    if (!open) break;
    count[open.i.id]++;
    free -= open.i.lanes;
  }
  return count;
}

/** Termin eines bereits angelegten Kurses im Bad. */
export type TakenSession = {
  start: string;
  end: string;
  lanes: number;
  name: string;
  /** Für den Kurs ist keine Uhrzeit hinterlegt. */
  noTime?: boolean;
};

export type PlannedSession = { date: string; start: string; end: string };
export type PlannedTerm = {
  id: string;
  track: Track;
  sessions: PlannedSession[];
  breaks: { date: string; note: string }[];
  /** Weniger Einheiten als vorgesehen: Vertragsende erreicht. */
  complete: boolean;
};

/**
 * Verteilt die Kurse auf die Termine.
 * `skip` enthält gesperrte Termine mit Grund (Familienschwimmen, entfällt, Feiertag …).
 * Pro Kursart und Kopie entsteht eine Folge hintereinander liegender Kurszeiträume.
 */
export function planTerms(
  slots: PoolSlot[],
  skip: Record<string, string>,
  kinds: KindSetting[],
  pause: number,
  poolLanes: number,
  taken: Record<string, TakenSession[]> = {},
): PlannedTerm[] {
  const out: PlannedTerm[] = [];
  for (const kind of kinds) {
    for (let copy = 1; copy <= kind.count; copy++) {
      const k = { ...kind, block: copyBlock(kind, copy, poolLanes) };
      const track: Track = { id: `${k.id}#${copy}`, kindId: k.id, copy, block: k.block };
      let cur: PlannedTerm | null = null;
      let pendingBreaks: { date: string; note: string }[] = [];
      let n = 0;
      for (const s of slots) {
        const fits = blocksFit(s, k.minutes, pause) > k.block;
        // Bereits angelegte Kurse belegen Bahnen: ist im Zeitblock nicht genug frei, entfällt der Termin.
        let busy: string | undefined;
        if (!s.closed && fits && s.start) {
          const from = toMin(s.start) + k.block * (k.minutes + pause);
          const clash = (taken[s.date] ?? []).filter(
            (t) => toMin(t.start) < from + k.minutes && toMin(t.end) > from,
          );
          if (clash.reduce((n, t) => n + t.lanes, 0) + k.lanes > poolLanes)
            busy = `belegt durch ${[...new Set(clash.map((t) => t.name))].join(", ")}`;
        }
        const reason = s.closed ? "Hallenbad geschlossen" : (skip[s.date] ?? busy);
        if (reason || !fits) {
          if (cur) pendingBreaks.push({ date: s.date, note: reason || "zu wenig Zeit im Bad" });
          continue;
        }
        if (!cur) {
          cur = {
            id: `${track.id}@${++n}`,
            track,
            sessions: [],
            breaks: [],
            complete: false,
          };
          out.push(cur);
          pendingBreaks = [];
        } else {
          cur.breaks.push(...pendingBreaks);
          pendingBreaks = [];
        }
        const startMin = toMin(s.start!) + k.block * (k.minutes + pause);
        cur.sessions.push({
          date: s.date,
          start: fromMin(startMin),
          end: fromMin(startMin + k.minutes),
        });
        if (cur.sessions.length >= k.units) {
          cur.complete = true;
          cur = null;
          pendingBreaks = [];
        }
      }
    }
  }
  return out.sort(
    (a, b) =>
      a.sessions[0].date.localeCompare(b.sessions[0].date) ||
      a.track.block - b.track.block ||
      a.track.id.localeCompare(b.track.id),
  );
}
