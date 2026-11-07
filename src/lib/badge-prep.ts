// Vorbereitung der letzten Kursstunde: Welches Kind bekommt welches Abzeichen, wer bekommt den Siggi-Pass?
// Reine Logik ohne Datenbankzugriff (wird vom Server und von der Erinnerungs-Mail genutzt).
import {
  EXAM_LEVELS,
  allCriteriaDone,
  countCriteriaDone,
  findExamLevel,
  type ExamCriteriaState,
} from "@/lib/swim-exams";

export type BadgePrepInput = {
  id: string;
  name: string | null;
  date_of_birth: string | null;
  badge: string | null;
  goal_reached: boolean | null;
  exam_level: string | null;
  exam_criteria: ExamCriteriaState | null;
  exam_date: string | null;
};

/** Kind, das sein Abzeichen schon geschafft hat. */
export type BadgeReady = {
  id: string;
  name: string;
  date_of_birth: string | null;
  /** Anzeigename des Abzeichens. */
  label: string;
  /** Schlüssel der Prüfungsstufe (null bei von Hand eingetragenem Abzeichen). */
  level: string | null;
  /** Datum, an dem das Abzeichen geschafft wurde. */
  date: string | null;
};

/** Kind ohne fertiges Abzeichen – bekommt den Siggi-Pass. */
export type SiggiRow = {
  id: string;
  name: string;
  date_of_birth: string | null;
  /** z. B. "Seeräuber: 2 von 4 Prüfungsteilen" – nur wenn schon etwas abgehakt ist. */
  progress: string | null;
};

export type BadgePrep = { ready: BadgeReady[]; siggi: SiggiRow[] };

function latestCriterionDate(state: ExamCriteriaState): string | null {
  const dates = Object.values(state ?? {})
    .filter((c) => c?.done && c.date)
    .map((c) => String(c.date))
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function buildBadgePrep(parts: BadgePrepInput[]): BadgePrep {
  const ready: BadgeReady[] = [];
  const siggi: SiggiRow[] = [];

  for (const p of parts) {
    const name = (p.name ?? "").trim() || "—";
    const state = (p.exam_criteria ?? {}) as ExamCriteriaState;
    const level = findExamLevel(p.exam_level);

    if (level && allCriteriaDone(level.key, state)) {
      ready.push({
        id: p.id,
        name,
        date_of_birth: p.date_of_birth,
        label: level.label,
        level: level.key,
        date: p.exam_date || latestCriterionDate(state),
      });
      continue;
    }

    // Von Hand eingetragenes Abzeichen ohne Prüfungsstufe (ältere Einträge)
    const manual = (p.badge ?? "").trim();
    if (!level && manual && p.goal_reached !== false) {
      ready.push({
        id: p.id,
        name,
        date_of_birth: p.date_of_birth,
        label: manual,
        level: null,
        date: p.exam_date,
      });
      continue;
    }

    const done = level ? countCriteriaDone(level.key, state) : 0;
    siggi.push({
      id: p.id,
      name,
      date_of_birth: p.date_of_birth,
      progress:
        level && done > 0
          ? `${level.label.split(" (")[0]}: ${done} von ${level.criteria.length} Prüfungsteilen`
          : null,
    });
  }

  const order = (r: BadgeReady) => {
    const i = EXAM_LEVELS.findIndex((l) => l.key === r.level);
    return i < 0 ? 999 : i;
  };
  ready.sort(
    (a, b) =>
      order(a) - order(b) ||
      a.label.localeCompare(b.label, "de") ||
      a.name.localeCompare(b.name, "de"),
  );
  siggi.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { ready, siggi };
}

/** Kurzfassung für die Mail ohne Namen: "2 × Seepferdchen, 1 × Bronze". */
export function summarizeReady(ready: BadgeReady[]): string[] {
  const counts = new Map<string, number>();
  for (const r of ready) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  return [...counts.entries()].map(([label, n]) => `${n} × ${label}`);
}
