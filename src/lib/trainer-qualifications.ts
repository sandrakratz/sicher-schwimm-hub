export const QUALIFICATION_KINDS = [
  {
    value: "erste_hilfe",
    label: "Erste-Hilfe-Kurs",
    /** Gilt so viele Jahre ab Ausstellung; null = Ablaufdatum wird selbst angegeben (oder gar keins). */
    years: 2,
    /** Pflicht-Nachweis: fehlt er, erscheint das als Handlungsbedarf. */
    required: true,
  },
  {
    value: "fuehrungszeugnis",
    label: "Erweitertes Führungszeugnis",
    years: 2,
    required: true,
  },
  {
    value: "rettungsschwimmer",
    label: "Rettungsschwimmer-Abzeichen",
    years: null,
    required: false,
  },
  { value: "trainerlizenz", label: "Trainer-/Übungsleiter-Lizenz", years: null, required: false },
  { value: "sonstiges", label: "Sonstiges", years: null, required: false },
] as const;

export type QualificationKind = (typeof QUALIFICATION_KINDS)[number]["value"];

export const kindInfo = (kind: string) => QUALIFICATION_KINDS.find((k) => k.value === kind);

export const qualificationLabel = (kind: string) => kindInfo(kind)?.label ?? kind;

/** Arten, die eine Person mehrfach eintragen darf (jeder Eintrag ist ein eigener Nachweis). */
export const MULTI_KINDS: readonly string[] = ["sonstiges"];

/** Schlüssel für die Prüfmarkierung: bei Mehrfach-Arten pro Eintrag, sonst pro Art. */
export const checkKeyOf = (kind: string, id: string) =>
  MULTI_KINDS.includes(kind) ? `${kind}:${id}` : kind;

/** Ablaufdatum aus Ausstellungsdatum (z. B. +2 Jahre); null, wenn die Art keine feste Frist hat. */
export function expiryFrom(kind: string, issuedOn: string): string | null {
  const years = kindInfo(kind)?.years;
  if (!years || !issuedOn) return null;
  const d = new Date(`${issuedOn}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Tage bis zum Ablauf (negativ = abgelaufen), `null` ohne Datum. */
export function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null;
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
}

/** Ab wie vielen Tagen vor Ablauf die Trainer:in per Mail erinnert wird. */
export const QUALIFICATION_WARN_DAYS = 30;
/** Ab wie vielen Tagen vor Ablauf der Vorstand in der Übersicht „bald fällig“ sieht. */
export const QUALIFICATION_BOARD_WARN_DAYS = 60;

/** Stand eines Nachweises für die Prüfung durch den Vorstand. */
export const qualificationStamp = (q: { issued_on?: string | null; valid_until?: string | null }) =>
  `${q.issued_on ?? ""}|${q.valid_until ?? ""}`;
