// Zentrale Konfiguration für Zahlungs-, Kontakt- und Vereinsdaten
// (E-Mails, Belege, Webseite). Diese Datei ist die einzige Quelle für
// Bankverbindung, Kontaktdaten und Mitgliedsbeiträge.

export const BILLING = {
  recipient: "Sicher-Schwimmen e.V.",
  iban: "DE85 3806 0186 5081 0160 13",
  bic: "GENODED1BRS",
  bankName: "VR Bank Hennef",
  /** Einheitlicher Text für den Verwendungszweck. */
  purpose: "Kursname + Name des Kindes + Kursbeginn (Startdatum)",
  /** Einheitlicher Hinweis zur Fälligkeit der Kursgebühr. */
  dueNote:
    "Die Kursgebühr wird nach der Buchungsbestätigung fällig: innerhalb von 14 Tagen nach der Bestätigung, spätestens jedoch einen Tag vor Kursbeginn.",
};

export const ORG = {
  name: "Sicher-Schwimmen e. V.",
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
};

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
  "Beitrag fällig jeweils zum 1. März per SEPA-Lastschrift. Bei Eintritt nach dem 1. Juli wird im Beitrittsjahr nur der halbe Jahresbeitrag (50 %) berechnet.";

/** Kursgebühren-Standardsätze (10 Einheiten à 45 Minuten). */
export const COURSE_FEES = {
  standard: 200,
  member: 150,
};

/** Primärfarbe (--primary-deep) als Hex für <meta name="theme-color">. */
export const THEME_COLOR = "#0a4d8c";

export function isBillingConfigured() {
  return Boolean(BILLING.iban && BILLING.recipient);
}
