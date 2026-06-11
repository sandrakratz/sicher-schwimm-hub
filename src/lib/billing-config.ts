// Zentrale Konfiguration für Zahlungsdaten in Kursbestätigungs-Emails.
// Sobald die Bankverbindung final feststeht, hier eintragen.

export const BILLING = {
  recipient: "Sicher-Schwimmen e.V.",
  iban: "", // z.B. "DE00 0000 0000 0000 0000 00"
  bic: "",  // z.B. "GENODEF1XXX"
  bankName: "",
};

export function isBillingConfigured() {
  return Boolean(BILLING.iban && BILLING.recipient);
}
