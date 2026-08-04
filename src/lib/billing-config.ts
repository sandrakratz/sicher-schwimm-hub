// Zentrale Konfiguration für Zahlungsdaten in Kursbestätigungs-Emails.
// Sobald die Bankverbindung final feststeht, hier eintragen.

export const BILLING = {
  recipient: "Sicher-Schwimmen e.V.",
  iban: "DE85 3805 0186 5081 0160 13",
  bic: "GENODED1BRS",
  bankName: "VR Bank Hennef",
};

export function isBillingConfigured() {
  return Boolean(BILLING.iban && BILLING.recipient);
}
