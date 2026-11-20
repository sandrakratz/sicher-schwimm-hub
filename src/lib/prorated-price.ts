// Anteilige Kursgebühr bei Buchung eines bereits gestarteten Kurses.
// Kursgebühr ÷ Anzahl der angelegten Termine × noch nicht vergangene Termine.
// Ein Termin am Buchungstag zählt noch mit. Reine Logik ohne Datenbank (Test: prorated-price.test.ts);
// die serverseitige Abfrage der Termine steht in prorated-price.server.ts.

export interface ProratedPrice {
  /** Zu zahlender Betrag (auf Cent gerundet). */
  price: number | null;
  /** Voller Kurspreis vor der Kürzung. */
  fullPrice: number | null;
  /** Anzahl aller Termine des Kurses. */
  total: number;
  /** Termine, die vor dem Buchungstag liegen und abgezogen werden. */
  past: number;
  /** true, wenn der Preis gekürzt wurde. */
  prorated: boolean;
}

/**
 * @param fullPrice    voller Kurspreis (Mitglieds- oder Normalpreis)
 * @param sessionDates Termine des Kurses (YYYY-MM-DD), ohne Pausen
 * @param bookedOn     Buchungstag als Berliner Kalendertag (YYYY-MM-DD)
 */
export function proratePrice(
  fullPrice: number | null,
  sessionDates: ReadonlyArray<string>,
  bookedOn: string,
): ProratedPrice {
  const total = sessionDates.length;
  const past = sessionDates.filter((d) => d < bookedOn).length;
  const unchanged: ProratedPrice = { price: fullPrice, fullPrice, total, past, prorated: false };
  // Ohne angelegte Termine, ohne vergangene Termine oder bei bereits beendetem Kurs keine Kürzung
  if (fullPrice == null || total === 0 || past === 0 || past >= total) return unchanged;
  const price = Math.round((Number(fullPrice) * (total - past) * 100) / total) / 100;
  return { price, fullPrice, total, past, prorated: true };
}
