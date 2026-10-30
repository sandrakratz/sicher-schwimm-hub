// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { analyzeVariants, normalCdf, twoProportionPValue } from "./stats";

describe("Statistik", () => {
  test("Normalverteilung", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  test("gleiche Anteile: p-Wert nahe 1", () => {
    expect(twoProportionPValue(50, 500, 50, 500)).toBeCloseTo(1, 3);
  });

  test("deutlicher Unterschied: kleiner p-Wert", () => {
    const p = twoProportionPValue(50, 500, 90, 500)!;
    expect(p).toBeLessThan(0.01);
  });

  test("zu wenig Daten: kein p-Wert", () => {
    const a = analyzeVariants([
      { variant: "control", visitors: 40, conversions: 4 },
      { variant: "kurz", visitors: 38, conversions: 9 },
    ]);
    expect(a.enoughData).toBe(false);
    expect(a.variants.every((v) => v.pValue === null)).toBe(true);
  });

  test("Basisvariante ist control", () => {
    const a = analyzeVariants([
      { variant: "alt", visitors: 200, conversions: 20 },
      { variant: "control", visitors: 200, conversions: 10 },
    ]);
    expect(a.baseline).toBe("control");
    expect(a.variants.find((v) => v.variant === "alt")!.diffPoints).toBeCloseTo(5, 5);
    expect(a.variants.find((v) => v.variant === "control")!.pValue).toBeNull();
  });

  test("keine Varianten", () => {
    expect(analyzeVariants([]).baseline).toBeNull();
  });
});
