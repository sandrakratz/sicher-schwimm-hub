// Rechenregeln der Übungsleiter-Abrechnung (rein, ohne Datenbank; client- und serverseitig nutzbar).

/** Jahresfreibetrag Übungsleiterpauschale (§ 3 Nr. 26 EStG, ab 2026). */
export const ANNUAL_ALLOWANCE = 3300;
/** Ab diesem Anteil des Freibetrags wird gewarnt. */
export const WARN_FRACTION = 0.8;

export type Rate = {
  id: string;
  trainer_id: string;
  program_id: string | null;
  hourly_rate: number;
  valid_from: string;
};

/**
 * Abgerechnete Stunden eines Termins: die am Kurs (bzw. Event) hinterlegten Stunden, sonst der Standard
 * der Kursart. Die tatsächliche Einsatzzeit zählt bewusst nicht (z. B. wer früher einbucht). Ohne
 * Angabe `null` – dann ist der Termin nicht zahlbar, bis Stunden festgelegt sind.
 */
export function resolveHours(
  courseHours: number | string | null | undefined,
  programHours: number | string | null | undefined,
): number | null {
  for (const v of [courseHours, programHours]) {
    const n = v === null || v === undefined ? NaN : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Satz, der am Termintag für Trainer:in und Kursart gilt: der jüngste mit „gültig ab“ bis zum Termin.
 * Gibt es für die Kursart keinen, gilt ersatzweise der Satz ohne Kursart (Standardsatz).
 */
export function pickRate(
  rates: readonly Rate[],
  trainerId: string,
  programId: string | null,
  date: string,
): Rate | null {
  const latest = (pid: string | null) =>
    rates
      .filter((r) => r.trainer_id === trainerId && r.program_id === pid && r.valid_from <= date)
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] ?? null;
  return latest(programId) ?? (programId ? latest(null) : null);
}

/** Auf Cent gerundeter Betrag. */
export function amountOf(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}

export function formatEuro(value: number): string {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
