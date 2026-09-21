// Prüfungskatalog nach der Deutschen Prüfungsordnung Schwimmen (DPO).
// Einzige Quelle für die Teilleistungen der Abzeichen – genutzt im
// Trainerbereich (Erfassung) und im Prüfungsprotokoll (PDF).

export type ExamCriterion = {
  /** Stabiler Schlüssel – wird in course_participants.exam_criteria gespeichert. */
  key: string;
  label: string;
  /** Zusätzliches Freitextfeld, z. B. für die gestoppte Zeit. */
  valueLabel?: string;
  valuePlaceholder?: string;
  /** Zweites Feld, z. B. Gesamtbahnen/-strecke in der vollen Schwimmzeit. */
  totalLabel?: string;
  totalPlaceholder?: string;
};

export type ExamLevel = {
  key: string;
  /** Name des Abzeichens, so wie er in Urkunde und Protokoll steht. */
  label: string;
  note?: string;
  criteria: Array<ExamCriterion>;
};

export const EXAM_LEVELS: Array<ExamLevel> = [
  {
    key: "seepferdchen",
    label: "Seepferdchen (Frühschwimmer)",
    criteria: [
      {
        key: "sprung_25m",
        label: "Sprung vom Beckenrand und 25 m Schwimmen in Bauch- oder Rückenlage",
      },
      {
        key: "ausatmen",
        label: "Grobform der Schwimmart erkennbar, sichtbares Ausatmen ins Wasser",
      },
      {
        key: "gegenstand",
        label: "Heraufholen eines Gegenstandes mit den Händen aus schultertiefem Wasser",
      },
      { key: "baderegeln", label: "Kenntnis der Baderegeln" },
    ],
  },
  {
    key: "seeraeuber",
    label: "Seeräuber (Vorbereitungsabzeichen)",
    note: "Freiwilliges Zwischenabzeichen auf dem Weg zu Bronze.",
    criteria: [
      { key: "100m_brust", label: "100 m Brustschwimmen", valueLabel: "Zeit", valuePlaceholder: "z. B. 4:10" },
      { key: "strecke_5m", label: "5 m Streckentauchen" },
      { key: "gegenstand_1m", label: "Heraufholen eines Gegenstandes aus ca. 1 m Tiefe" },
      { key: "baderegeln", label: "Kenntnis der Baderegeln" },
    ],
  },
  {
    key: "bronze",
    label: "Deutsches Schwimmabzeichen Bronze (Freischwimmer)",
    criteria: [
      { key: "sprung_kopf", label: "Sprung kopfwärts vom Beckenrand" },
      {
        key: "200m",
        label:
          "15 Minuten Dauerschwimmen, dabei mindestens 200 m (150 m Bauch-/Rückenlage, 50 m andere Lage)",
        valueLabel: "Zeit bei 200 m",
        valuePlaceholder: "z. B. 11:45",
        totalLabel: "Gesamt in 15 Min.",
        totalPlaceholder: "z. B. 18 Bahnen (225 m)",
      },
      { key: "tieftauchen", label: "Ca. 2 m Tieftauchen von der Wasseroberfläche mit Heraufholen eines Ringes" },
      { key: "paketsprung", label: "Paketsprung vom Startblock oder 1-m-Brett" },
      { key: "baderegeln", label: "Kenntnis der Baderegeln" },
    ],
  },
  {
    key: "silber",
    label: "Deutsches Schwimmabzeichen Silber",
    criteria: [
      { key: "sprung_kopf", label: "Sprung kopfwärts vom Beckenrand" },
      {
        key: "400m",
        label: "400 m Schwimmen in höchstens 25 Minuten (300 m Bauch-/Rückenlage, 100 m andere Lage)",
        valueLabel: "Zeit",
        valuePlaceholder: "z. B. 21:30",
      },
      { key: "tieftauchen", label: "2 m Tieftauchen von der Wasseroberfläche mit Heraufholen eines Ringes" },
      { key: "strecke_10m", label: "10 m Streckentauchen mit Abstoßen vom Beckenrand" },
      { key: "sprung_3m", label: "Sprung aus 3 m Höhe oder zwei verschiedene Sprünge aus 1 m Höhe" },
      { key: "baderegeln_selbst", label: "Kenntnis der Baderegeln und des Verhaltens zur Selbstrettung" },
    ],
  },
  {
    key: "gold",
    label: "Deutsches Schwimmabzeichen Gold",
    criteria: [
      {
        key: "800m",
        label: "800 m Schwimmen in höchstens 30 Minuten (650 m Bauch-/Rückenlage, 150 m andere Lage)",
        valueLabel: "Zeit",
        valuePlaceholder: "z. B. 27:10",
      },
      {
        key: "50m_brust",
        label: "50 m Brustschwimmen in höchstens 1:15 Minuten",
        valueLabel: "Zeit",
        valuePlaceholder: "z. B. 1:08",
      },
      { key: "25m_kraul", label: "25 m Kraulschwimmen" },
      {
        key: "50m_ruecken",
        label: "50 m Rückenschwimmen mit Grätschschwung ohne Armtätigkeit oder Kraulbeinschlag",
      },
      { key: "strecke_10m", label: "10 m Streckentauchen aus der Schwimmlage (ohne Abstoßen)" },
      { key: "drei_ringe", label: "Tieftauchen ca. 2 m: drei Gegenstände innerhalb von 3 Minuten heraufholen" },
      {
        key: "sprung_3m",
        label: "Sprung aus 3 m Höhe oder zwei verschiedene Sprünge aus 1 m Höhe (davon einer kopfwärts)",
      },
      { key: "transport", label: "50 m Transportschwimmen (Schieben oder Ziehen)" },
      {
        key: "baderegeln_rettung",
        label: "Kenntnis der Baderegeln, der Selbstrettung und einfacher Fremdrettungsmaßnahmen",
      },
    ],
  },
];

/** Einzelner Prüfungsteil, wie er gespeichert wird. */
export type ExamCriterionState = {
  done?: boolean;
  value?: string | null;
  /** Zweiter Wert, z. B. Gesamtbahnen in der vollen Schwimmzeit. */
  total?: string | null;
};
export type ExamCriteriaState = Record<string, ExamCriterionState>;

export function findExamLevel(key: string | null | undefined): ExamLevel | null {
  if (!key) return null;
  return EXAM_LEVELS.find(l => l.key === key) ?? null;
}

export function examLevelLabel(key: string | null | undefined): string {
  return findExamLevel(key)?.label ?? (key || "—");
}

/** Prüft, ob alle Teilleistungen des Abzeichens abgehakt sind. */
export function allCriteriaDone(levelKey: string | null | undefined, state: ExamCriteriaState): boolean {
  const level = findExamLevel(levelKey);
  if (!level) return false;
  return level.criteria.every(c => state?.[c.key]?.done === true);
}

/** Anzahl der erfüllten Teilleistungen. */
export function countCriteriaDone(levelKey: string | null | undefined, state: ExamCriteriaState): number {
  const level = findExamLevel(levelKey);
  if (!level) return 0;
  return level.criteria.filter(c => state?.[c.key]?.done === true).length;
}
