/** REWE „Scheine für Vereine“ – Aktionsdaten und Laufzeit. */

export const REWE_SFV_URL =
  "https://scheinefuervereine.rewe.de#verein-10000091620?ecid=cop_widget_Q3-26-SFV_toolkit_widget_nn_nn_nn";

export const REWE_SFV_IMAGE =
  "https://scheinefuervereine.rewe.de/widget/sfv_widget_240x45px.png";

export const REWE_SFV_TITLE =
  "Zum Profil des Vereins Sicher Schwimmen e.V. auf der Scheine für Vereine Aktionswebsite";

export const REWE_SFV_ALT = "REWE Scheine für Vereine – Sicher Schwimmen e.V.";

/** Ende der Sichtbarkeit: 15.10.2026, 23:59:59 Berliner Zeit (UTC+2). */
export const REWE_CAMPAIGN_END = new Date("2026-10-15T23:59:59+02:00");

export function isReweCampaignActive(now: Date = new Date()): boolean {
  return now.getTime() <= REWE_CAMPAIGN_END.getTime();
}
