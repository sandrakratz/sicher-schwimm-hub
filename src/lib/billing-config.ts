// Zentrale Konfiguration für Zahlungs- und Vereinsdaten (E-Mails, Belege, Webseite).

export const BILLING = {
  recipient: "Sicher-Schwimmen e.V.",
  iban: "DE85 3806 0186 5081 0160 13",
  bic: "GENODED1BRS",
  bankName: "VR Bank Hennef",
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
  vatNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
};

export function isBillingConfigured() {
  return Boolean(BILLING.iban && BILLING.recipient);
}
