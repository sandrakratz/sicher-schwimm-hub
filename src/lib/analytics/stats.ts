export type VariantResult = { variant: string; visitors: number; conversions: number };

export type VariantAnalysis = VariantResult & {
  rate: number;
  /** Unterschied zur Basisvariante in Prozentpunkten, null bei der Basisvariante selbst */
  diffPoints: number | null;
  /** zweiseitiger p-Wert (Zwei-Stichproben-Z-Test), null bei der Basisvariante oder zu wenig Daten */
  pValue: number | null;
};

/** Mindestanzahl Besucher je Variante, bevor wir überhaupt ein Ergebnis nennen. */
export const MIN_VISITORS_PER_VARIANT = 100;

/** Standardnormalverteilung, Verteilungsfunktion (Näherung nach Abramowitz & Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Zwei-Stichproben-Z-Test für Anteile, zweiseitig. */
export function twoProportionPValue(c1: number, n1: number, c2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (c2 / n2 - c1 / n1) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Vergleicht alle Varianten mit der Basisvariante ("control", sonst die erste in alphabetischer Reihenfolge).
 * Ergebnisse gelten nur für genau diese Experimentversion.
 */
export function analyzeVariants(results: VariantResult[]): {
  baseline: string | null;
  variants: VariantAnalysis[];
  enoughData: boolean;
} {
  if (results.length === 0) return { baseline: null, variants: [], enoughData: false };
  const sorted = [...results].sort((a, b) => a.variant.localeCompare(b.variant));
  const base = sorted.find((r) => r.variant === "control") ?? sorted[0]!;
  const enoughData = sorted.every((r) => r.visitors >= MIN_VISITORS_PER_VARIANT);
  const variants = sorted.map((r) => {
    const rate = r.visitors > 0 ? r.conversions / r.visitors : 0;
    const isBase = r === base;
    return {
      ...r,
      rate,
      diffPoints: isBase
        ? null
        : (rate - (base.visitors ? base.conversions / base.visitors : 0)) * 100,
      pValue:
        isBase || !enoughData
          ? null
          : twoProportionPValue(base.conversions, base.visitors, r.conversions, r.visitors),
    };
  });
  return { baseline: base.variant, variants, enoughData };
}
