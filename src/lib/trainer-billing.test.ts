// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  amountOf,
  capCheck,
  certificateSigners,
  pickRate,
  resolveHours,
  type Rate,
} from "./trainer-billing";

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

describe("Harte Grenze 3.300 €", () => {
  test("genau bis zur Grenze erlaubt, darüber nicht", () => {
    expect(capCheck(3000, 0, 300)).toEqual({ after: 3300, remaining: 300, over: false });
    expect(capCheck(3000, 0, 300.01).over).toBe(true);
  });

  test("bei anderen Auftraggebern genutzter Freibetrag zählt mit", () => {
    const c = capCheck(1000, 2000, 400);
    expect(c.remaining).toBe(300);
    expect(c.over).toBe(true);
  });

  test("Rest wird nie negativ", () => {
    expect(capCheck(3500, 0, 0).remaining).toBe(0);
  });
});

describe("Unterschriften der Jahresbescheinigung", () => {
  const board = [
    { name: "Vorsitz Eins", role: "1. Vorsitzende:r" },
    { name: "Vorsitz Zwei", role: "2. Vorsitzende:r" },
  ];
  const treasurer = { name: "Kasse Drei", role: "Kassenwart:in" };

  const names = (t: string) => certificateSigners(t, board, treasurer).map((s) => s.name);

  test("andere Trainer:innen: Kasse und erstes Vorstandsmitglied", () => {
    expect(names("Trainer Vier")).toEqual(["Kasse Drei", "Vorsitz Eins"]);
  });

  test("eigene Bescheinigung eines Vorstands: Kasse und das andere Vorstandsmitglied", () => {
    expect(names("Vorsitz Eins")).toEqual(["Kasse Drei", "Vorsitz Zwei"]);
    expect(names(" vorsitz  zwei ")).toEqual(["Kasse Drei", "Vorsitz Eins"]);
  });

  test("eigene Bescheinigung der Kasse: beide Vorstandsmitglieder", () => {
    expect(names("Kasse Drei")).toEqual(["Vorsitz Eins", "Vorsitz Zwei"]);
  });
});
