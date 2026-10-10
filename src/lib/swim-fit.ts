// „Passt das?“-Prüfung vor einem Platzangebot: Schwimmniveau des Kindes und Wunschtag der Eltern
// gegen Mindest-Niveau und Kurstag des Programms. Reine Funktionen, serverseitig (automatische
// Platzvergabe) und im Browser (Verwaltung) gleichermaßen nutzbar.

export const SWIM_LEVELS = [
  { value: 0, label: "Keine Wassererfahrung" },
  { value: 1, label: "Wassergewöhnt, kann nicht schwimmen" },
  { value: 2, label: "Erste Schwimmversuche" },
  { value: 3, label: "Seepferdchen" },
  { value: 4, label: "Sicherer Schwimmer" },
  { value: 5, label: "Bronze" },
  { value: 6, label: "Silber" },
  { value: 7, label: "Gold" },
] as const;

export const WEEKDAYS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 7, label: "Sonntag" },
] as const;

export const levelLabel = (v: number | null | undefined) =>
  SWIM_LEVELS.find((l) => l.value === v)?.label ?? "–";
export const weekdayLabel = (v: number | null | undefined) =>
  WEEKDAYS.find((d) => d.value === v)?.label ?? "–";

/** Ordnet die Angabe aus dem Formular einer Stufe zu (null = nicht erkennbar). */
export function levelOf(text: string | null | undefined): number | null {
  const l = (text ?? "").toLowerCase();
  if (!l.trim()) return null;
  if (/gold/.test(l)) return 7;
  if (/silber/.test(l)) return 6;
  if (/bronze/.test(l)) return 5;
  if (/sicher/.test(l)) return 4;
  if (/seepferd/.test(l)) return 3;
  if (/erste/.test(l)) return 2;
  if (/gew(ö|oe)hnt/.test(l)) return 1;
  if (/keine/.test(l)) return 0;
  return null;
}

/** Schwimmniveau aus den Anmerkungen eines Eintrags („Schwimmlevel: …“). */
export function levelTextFromNotes(notes: string | null | undefined): string | null {
  for (const line of (notes ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*Schwimm(?:level|niveau):\s*(.*)$/i);
    if (m) return m[1]!.trim() || null;
  }
  return null;
}

const DAY_RE = /(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag)s?\b/gi;
const DAY_NO: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
  sonntag: 7,
};

/**
 * Wunschtage der Eltern: bevorzugt die strukturierte Zeile „Wunschtag: …“ aus dem Formular, sonst
 * Wochentage im Freitext. `uncertain` = Verneinung in der Nähe („nicht Samstag“): immer manuell prüfen.
 */
export function wishedWeekdays(notes: string | null | undefined): {
  days: number[];
  uncertain: boolean;
  structured: boolean;
} {
  const text = notes ?? "";
  const line = text.match(/^\s*Wunschtage?:\s*(.*)$/im);
  if (line) {
    const days = [...line[1]!.matchAll(DAY_RE)].map((m) => DAY_NO[m[1]!.toLowerCase()]!);
    return { days: [...new Set(days)], uncertain: false, structured: true };
  }
  const days = new Set<number>();
  let uncertain = false;
  for (const m of text.matchAll(DAY_RE)) {
    days.add(DAY_NO[m[1]!.toLowerCase()]!);
    const before = text.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0).toLowerCase();
    if (/(nicht|kein|keine|keinen|außer|leider|ungünstig)\W+(?:\S+\W+){0,2}$/.test(before))
      uncertain = true;
  }
  return { days: [...days], uncertain, structured: false };
}

export type FitProgram = {
  name?: string | null;
  min_swim_level?: number | null;
  weekday?: number | null;
};

export type Fit = { ok: boolean; issues: string[] };

/** Prüft Niveau und Wunschtag; `ok` = darf automatisch angeboten werden. */
export function checkFit(notes: string | null | undefined, program: FitProgram | null): Fit {
  const issues: string[] = [];
  if (!program) return { ok: true, issues };

  const min = program.min_swim_level;
  if (min != null && min > 0) {
    const text = levelTextFromNotes(notes);
    const level = levelOf(text);
    if (level == null) {
      issues.push(`Schwimmniveau unbekannt (verlangt: mindestens „${levelLabel(min)}“)`);
    } else if (level < min) {
      issues.push(
        `Schwimmniveau „${levelLabel(level)}“ liegt unter dem Mindest-Niveau „${levelLabel(min)}“`,
      );
    }
  }

  const day = program.weekday;
  if (day != null) {
    const wish = wishedWeekdays(notes);
    if (wish.days.length > 0 && !wish.days.includes(day)) {
      const names = wish.days.map((d) => weekdayLabel(d)).join("/");
      issues.push(
        wish.structured
          ? `Wunschtag ${names} – der Kurs findet ${weekdayLabel(day)} statt`
          : `Elternhinweis nennt ${names} – der Kurs findet ${weekdayLabel(day)} statt`,
      );
    } else if (wish.uncertain) {
      issues.push(`Elternhinweis zu Wochentagen bitte prüfen (Kurs: ${weekdayLabel(day)})`);
    }
  }
  return { ok: issues.length === 0, issues };
}
