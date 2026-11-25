// Zentrale Konfiguration für Zahlungs-, Kontakt- und Vereinsdaten
// (E-Mails, Belege, Webseite). Diese Datei ist die einzige Quelle für
// Bankverbindung, Kontaktdaten und Mitgliedsbeiträge.

export const BILLING = {
  recipient: "Sicher Schwimmen e.V.",
  iban: "DE85 3806 0186 5081 0160 13",
  bic: "GENODED1BRS",
  bankName: "VR Bank Hennef",
  /** SEPA-Gläubiger-Identifikationsnummer des Vereins (steht auf jedem Lastschriftmandat). */
  creditorId: "DE32ZZZ00002935195",
  /** Einheitlicher Text für den Verwendungszweck. */
  purpose: "Kursname + Name des Kindes + Kursbeginn (Startdatum)",
  /** Einheitlicher Hinweis zur Fälligkeit der Kursgebühr. */
  dueNote:
    "Die Kursgebühr wird nach der Buchungsbestätigung fällig: innerhalb von 14 Tagen nach der Bestätigung, spätestens jedoch bis 10 Tage vor Kursbeginn. Wird ein Kurs innerhalb der letzten 10 Tage vor Kursbeginn gebucht, ist die Kursgebühr sofort per Echtzeit-/Sofortüberweisung zu zahlen.",
};

export const ORG = {
  name: "Sicher Schwimmen e.V.",
  street: "Bergstr. 67a",
  zipCity: "53773 Hennef",
  register: "Vereinsregister: Amtsgericht Siegburg, VR 4149",
  city: "Hennef",
  signatory: "Michael Kratz, 1. Vorsitzender",
  email: "info@sicher-schwimmen.com",
  phone: "0178 / 1142945",
  phoneContact: "0178 / 1142945 (Michael Kratz)",
  phoneIntl: "+49-178-1142945",
  areaShort: "Hennef, Rhein-Sieg-Kreis",
  vatNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  /** Bescheid des Finanzamts über die satzungsmäßigen Voraussetzungen (§ 60a AO) – für Bescheinigungen */
  taxOffice: "Finanzamt Siegburg",
  taxNoticeDate: "2026-06-24",
};

/** Offizielle Social-Media-Kanäle – zentrale Quelle für Footer, Kontakt und JSON-LD. */
export const SOCIAL = [
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/sicherschwimmen/" },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/sicherschwimmen/" },
] as const;

/** Verbandsmitgliedschaft des Vereins. */
export const ASSOCIATION = {
  name: "Schwimmverband NRW",
  url: "https://www.schwimmverband.nrw",
} as const;

/** Einheitliche Ortsangabe für Kurse (genauer Kursort wird später zugeordnet). */
export const COURSE_LOCATION = "Schwimmbad im Rhein-Sieg-Kreis";

/** Kontaktangaben, wie sie auf Kontaktseite und im Footer erscheinen. */
export const CONTACT_ITEMS = [
  { key: "address", title: "Adresse", text: ORG.areaShort },
  { key: "email", title: "E-Mail", text: ORG.email },
  { key: "phone", title: "Telefon", text: ORG.phoneContact },
] as const;

/** Jahresbeiträge – zentrale Quelle für Webseite, FAQ und Mitgliedsordnung. */
export const MEMBERSHIP_FEES = {
  children_youth: 60,
  adult: 60,
  family: 96,
  supporting_min: 60,
};

export const MEMBERSHIP_BILLING_NOTE =
  "Der Beitrag wird per SEPA-Lastschrift eingezogen: bei laufenden Mitgliedschaften jeweils zum 1. März, bei Neueintritt innerhalb von 4 Wochen nach der Aufnahmebestätigung. Bei Eintritt nach dem 1. Juli wird im Beitrittsjahr nur der halbe Jahresbeitrag (50 %) berechnet.";

/** Kursgebühren-Standardsätze (10 Einheiten à 45 Minuten). */
export const COURSE_FEES = {
  standard: 200,
  member: 150,
};

/**
 * Stornogebühr bei Rücktritt bzw. Umbuchung durch die Eltern – muss mit § 3 der
 * Kursteilnahmebedingungen (/kursbedingungen) übereinstimmen.
 * Bis 3 Wochen vor Kursbeginn kostenfrei, danach 50 %, weniger als 7 Tage vorher 100 %.
 */
export function cancellationFeeRule(daysBeforeStart: number | null): {
  pct: number;
  label: string;
} {
  if (daysBeforeStart == null) return { pct: 0, label: "Kursbeginn unbekannt" };
  if (daysBeforeStart >= 21)
    return { pct: 0, label: "mehr als 3 Wochen vor Kursbeginn – kostenfrei" };
  if (daysBeforeStart >= 7)
    return { pct: 50, label: "weniger als 3 Wochen bis 7 Tage vor Kursbeginn" };
  return { pct: 100, label: "weniger als 7 Tage vor Kursbeginn" };
}

/** Primärfarbe (--primary-deep) als Hex für <meta name="theme-color">. */
export const THEME_COLOR = "#0a4d8c";

export function isBillingConfigured() {
  return Boolean(BILLING.iban && BILLING.recipient);
}

/**
 * Beitrag im Beitrittsjahr: bei Eintritt nach dem 1. Juli nur der halbe Jahresbeitrag
 * (muss mit MEMBERSHIP_BILLING_NOTE übereinstimmen). `startIso` = Mitglied ab (JJJJ-MM-TT).
 */
export function firstYearFee(
  type: keyof typeof MEMBERSHIP_FEES | "supporting",
  startIso: string,
): { annual: number; firstYear: number; half: boolean } {
  const annual = type === "supporting" ? MEMBERSHIP_FEES.supporting_min : MEMBERSHIP_FEES[type];
  const half = startIso > `${startIso.slice(0, 4)}-07-01`;
  return { annual, firstYear: half ? annual / 2 : annual, half };
}

/** Unterschriften auf der Übungsleiter-Jahresbescheinigung (siehe certificateSigners). */
export const CERT_BOARD = [
  { name: "Michael Kratz", role: "1. Vorsitzender" },
  { name: "Sandra Kratz", role: "2. Vorsitzende" },
];
export const CERT_TREASURER = { name: "Manuela Scholz-Ornowski", role: "Kassenwartin" };
