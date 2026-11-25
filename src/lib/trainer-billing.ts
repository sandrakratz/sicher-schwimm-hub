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

/** Weiterhin hier erreichbar für bestehende Importe (z. B. trainer-certificate.ts). */
export { formatEuro } from "@/lib/format";

export type CapCheck = {
  /** Summe im Jahr nach dieser Auszahlung, inkl. Freibetrag, der bei anderen Auftraggebern genutzt wurde */
  after: number;
  /** Rest bis zur Grenze vor dieser Auszahlung (nie negativ) */
  remaining: number;
  over: boolean;
};

/**
 * Harte Grenze: Jahresfreibetrag minus bereits gezahlter Beträge (auch zur Freigabe angelegte) minus
 * dem, was die Trainer:in laut Jahreserklärung schon bei anderen Auftraggebern nutzt.
 */
export function capCheck(paidYear: number, otherAllowance: number, amount: number): CapCheck {
  const used = Math.round((paidYear + otherAllowance) * 100) / 100;
  const after = Math.round((used + amount) * 100) / 100;
  return {
    after,
    remaining: Math.max(0, Math.round((ANNUAL_ALLOWANCE - used) * 100) / 100),
    over: after > ANNUAL_ALLOWANCE,
  };
}

export type Signer = { name: string; role: string };

/**
 * Unterschriften der Jahresbescheinigung (Vorstand 25.11.2026): die Kassenwartin, die abrechnet, und ein
 * Vorstandsmitglied, das kontrolliert – das erste der Liste, das nicht selbst die Trainer:in ist. Ist die
 * Kassenwartin selbst die Trainer:in, unterschreiben die beiden Vorstandsmitglieder. Niemand bescheinigt
 * sich selbst etwas.
 */
export function certificateSigners(
  trainerName: string,
  board: Signer[],
  treasurer: Signer,
): Signer[] {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const self = norm(trainerName);
  const others = board.filter((b) => norm(b.name) !== self);
  if (norm(treasurer.name) === self) return others.slice(0, 2);
  return [treasurer, ...others.slice(0, 1)];
}
