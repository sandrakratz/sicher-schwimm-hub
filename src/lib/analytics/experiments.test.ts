// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  EXPERIMENTS,
  isKnownExperimentRef,
  pickVariant,
  validateExperiments,
  type ExperimentDefinition,
} from "./experiments";

const def: ExperimentDefinition = {
  key: "test_a",
  version: 1,
  description: "Test",
  variants: { control: 50, b: 30, c: 20 },
  control: "control",
  goal: { event: "form_submit_success" },
  status: "running",
  startedAt: "2026-01-01T00:00:00Z",
};

describe("A/B-Tests", () => {
  test("die echten Definitionen sind gültig", () => {
    expect(validateExperiments()).toEqual([]);
  });

  test("Zuweisung ist stabil pro Besucher", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(pickVariant(def, id)).toBe(pickVariant(def, id));
  });

  test("Verteilung entspricht den Gewichten", () => {
    const counts: Record<string, number> = { control: 0, b: 0, c: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) counts[pickVariant(def, crypto.randomUUID())]!++;
    expect(counts.control! / n).toBeGreaterThan(0.47);
    expect(counts.control! / n).toBeLessThan(0.53);
    expect(counts.b! / n).toBeGreaterThan(0.27);
    expect(counts.b! / n).toBeLessThan(0.33);
    expect(counts.c! / n).toBeGreaterThan(0.17);
    expect(counts.c! / n).toBeLessThan(0.23);
  });

  test("neue Version würfelt neu", () => {
    let differing = 0;
    for (let i = 0; i < 2000; i++) {
      const id = crypto.randomUUID();
      if (pickVariant(def, id) !== pickVariant({ ...def, version: 2 }, id)) differing++;
    }
    expect(differing).toBeGreaterThan(500);
  });

  test("ungültige Definitionen werden erkannt", () => {
    expect(validateExperiments([{ ...def, variants: { control: 60, b: 30 } }])).not.toEqual([]);
    expect(validateExperiments([{ ...def, control: "fehlt" }])).not.toEqual([]);
    expect(validateExperiments([{ ...def, status: "stopped" }])).not.toEqual([]);
    expect(validateExperiments([def, def])).not.toEqual([]);
  });

  test("Entwürfe werden nie angenommen", () => {
    const draft = EXPERIMENTS.find((e) => e.status === "draft");
    if (draft) {
      expect(
        isKnownExperimentRef({ key: draft.key, version: draft.version, variant: draft.control }),
      ).toBe(false);
    }
    expect(isKnownExperimentRef({ key: "gibt_es_nicht", version: 1, variant: "control" })).toBe(
      false,
    );
  });
});
