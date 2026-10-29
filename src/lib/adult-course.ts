// Erwachsenenschwimmen: gemeinsame Konstanten und Auswahlwerte für Formular und Verwaltung.
// Preise und Eckdaten kommen in der Anzeige aus dem Kursangebot (Datenbank); die Werte hier sind nur Rückfall.

import { z } from "zod";

export const ADULT_COURSE_SLUG = "erwachsenenschwimmen";
export const ADULT_COURSE_NAME = "Erwachsenenschwimmen – sicher schwimmen lernen";
export const ADULT_COURSE_START_LABEL = "13.02.2027";
export const ADULT_COURSE_PRICE_MEMBER = 159;
export const ADULT_COURSE_PRICE_NON_MEMBER = 179;

export const SWIM_LEVELS = {
  cannot: "Ich kann noch nicht schwimmen.",
  unsure: "Ich kann einige Meter schwimmen, fühle mich aber unsicher.",
  basics: "Ich beherrsche die Grundlagen und möchte sicherer werden.",
} as const;

export const SATURDAY_AVAILABILITY = {
  flexible: "Ich bin zeitlich flexibel.",
  morning: "Ich bevorzuge den Vormittag.",
  specific: "Ich kann nur zu bestimmten Uhrzeiten teilnehmen.",
} as const;

export const MEMBER_STATUS_STATED = {
  yes: "Ich bin bereits Mitglied.",
  no: "Ich bin noch kein Mitglied.",
  unsure: "Ich bin mir nicht sicher.",
} as const;

export function priceOptions(member: number, nonMember: number) {
  return {
    member_159: `${member} € als Vereinsmitglied kommen für mich infrage.`,
    non_member_179: `${nonMember} € als Nichtmitglied kommen für mich infrage.`,
    check_dates: "Ich möchte erst die konkreten Termine prüfen.",
  } as const;
}

/** Kurzform für Verwaltung und Export (feste Beschriftung, unabhängig vom Preis). */
export const PRICE_PREFERENCE_SHORT = {
  member_159: "Mitgliedspreis",
  non_member_179: "Nichtmitgliedspreis",
  check_dates: "erst Termine prüfen",
} as const;

export const SWIM_LEVEL_SHORT = {
  cannot: "kann nicht schwimmen",
  unsure: "unsicher",
  basics: "Grundlagen vorhanden",
} as const;

export const AVAILABILITY_SHORT = {
  flexible: "flexibel",
  morning: "vormittags",
  specific: "bestimmte Uhrzeiten",
} as const;

export const INTEREST_STATUS = {
  new: "Neu",
  contacted: "Kontakt aufgenommen",
  question_open: "Rückfrage offen",
  informed: "Informiert",
  not_interested: "Nicht mehr interessiert",
  converted: "In verbindliche Anmeldung übernommen",
} as const;

export type InterestStatus = keyof typeof INTEREST_STATUS;
export type SwimLevel = keyof typeof SWIM_LEVELS;
export type SaturdayAvailability = keyof typeof SATURDAY_AVAILABILITY;
export type PricePreference = keyof ReturnType<typeof priceOptions>;
export type MemberStatusStated = keyof typeof MEMBER_STATUS_STATED;

export const INTEREST_STATUS_KEYS = Object.keys(INTEREST_STATUS) as [
  InterestStatus,
  ...InterestStatus[],
];

/** Gleiche Person unter mehreren Adressen: gleicher Name oder gleiche Telefonnummer (Ziffern). */
export function duplicateKeys(r: {
  first_name: string;
  last_name: string;
  phone: string | null;
}): string[] {
  const keys: string[] = [];
  const name = `${r.first_name} ${r.last_name}`.trim().replace(/\s+/g, " ").toLowerCase();
  if (name.includes(" ")) keys.push(`n:${name}`);
  const digits = (r.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 6) keys.push(`p:${digits}`);
  return keys;
}

/** Ids aller Einträge, die mit mindestens einem anderen Eintrag Name oder Telefon teilen. */
export function findPossibleDuplicates(
  rows: Array<{ id: string; first_name: string; last_name: string; phone: string | null }>,
): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const r of rows)
    for (const k of duplicateKeys(r)) byKey.set(k, [...(byKey.get(k) ?? []), r.id]);
  const out = new Set<string>();
  for (const ids of byKey.values()) if (ids.length > 1) for (const id of ids) out.add(id);
  return out;
}

/** Eingabe der Interessenbekundung – wird im Formular und auf dem Server gleich geprüft. */
export const interestInputSchema = z.object({
  firstName: z.string().trim().min(1, "Bitte Vornamen angeben.").max(60),
  lastName: z.string().trim().min(1, "Bitte Nachnamen angeben.").max(60),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(200),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  swimLevel: z.enum(["cannot", "unsure", "basics"], { message: "Bitte Schwimmstand wählen." }),
  saturdayAvailability: z.enum(["flexible", "morning", "specific"], {
    message: "Bitte Verfügbarkeit wählen.",
  }),
  pricePreference: z.enum(["member_159", "non_member_179", "check_dates"], {
    message: "Bitte eine Einschätzung zum Preis wählen.",
  }),
  memberStatus: z.enum(["yes", "no", "unsure"]).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  privacyAccepted: z.literal(true, { message: "Bitte bestätigen Sie die Datenschutzhinweise." }),
  /** Honeypot: muss leer bleiben */
  website: z.string().max(0).optional(),
});
export type InterestInput = z.infer<typeof interestInputSchema>;

/** Angebote ab 18 Jahren buchen Erwachsene für sich selbst (eigenes Buchungsformular ohne Kinderangaben). */
export function isAdultProgram(p: { min_age_years: number | null }): boolean {
  return (p.min_age_years ?? 0) >= 18;
}
