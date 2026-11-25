// „Passt das?“-Prüfung vor einem Platzangebot: Schwimmniveau des Kindes
// gegen das Mindest-Niveau des Programms. Reine Funktionen, serverseitig (automatische
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

export const levelLabel = (v: number | null | undefined) =>
  SWIM_LEVELS.find((l) => l.value === v)?.label ?? "–";

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

export type FitProgram = {
  name?: string | null;
  min_swim_level?: number | null;
};

export type Fit = { ok: boolean; issues: string[] };

/** Prüft das Schwimmniveau; `ok` = darf automatisch angeboten werden. */
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
  return { ok: issues.length === 0, issues };
}
