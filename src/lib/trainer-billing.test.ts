// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { amountOf, pickRate, resolveHours, type Rate } from "./trainer-billing";

describe("Abgerechnete Stunden", () => {
  test("Stunden des Kurses gehen vor dem Standard der Kursart", () => {
    expect(resolveHours(1.5, 2)).toBe(1.5);
    expect(resolveHours("2.00", 1)).toBe(2);
  });
  test("ohne Kurs-Angabe gilt die Kursart", () => {
    expect(resolveHours(null, 2)).toBe(2);
    expect(resolveHours(undefined, "1.00")).toBe(1);
  });
  test("ohne jede Angabe oder mit 0 keine Stunden", () => {
    expect(resolveHours(null, null)).toBeNull();
    expect(resolveHours(0, null)).toBeNull();
  });
});

const rate = (id: string, program: string | null, value: number, from: string): Rate => ({
  id,
  trainer_id: "t1",
  program_id: program,
  hourly_rate: value,
  valid_from: from,
});

describe("Satz je Kursart und Gültigkeit", () => {
  const rates = [
    rate("a", "p1", 20, "2026-01-01"),
    rate("b", "p1", 25, "2026-06-01"),
    rate("c", null, 15, "2026-01-01"),
  ];
  test("jüngster Satz bis zum Termin gilt", () => {
    expect(pickRate(rates, "t1", "p1", "2026-03-01")?.id).toBe("a");
    expect(pickRate(rates, "t1", "p1", "2026-06-01")?.id).toBe("b");
  });
  test("ohne Satz für die Kursart gilt der Standardsatz", () => {
    expect(pickRate(rates, "t1", "p2", "2026-03-01")?.id).toBe("c");
  });
  test("vor dem ersten Gültig-ab oder für andere Trainer: kein Satz", () => {
    expect(pickRate(rates, "t1", "p1", "2025-12-31")).toBeNull();
    expect(pickRate(rates, "t2", "p1", "2026-03-01")).toBeNull();
  });
});

describe("Betrag", () => {
  test("auf Cent gerundet", () => {
    expect(amountOf(2, 12.345)).toBe(24.69);
  });
});
