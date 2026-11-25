// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { matchProgram, meetsMinAge, minAgeReachedOn, withinMaxAge } from "./waitlist-age";

describe("Mindestalter (Kalendermonate, bis einschließlich)", () => {
  test("am Geburtstag ist das Alter erreicht", () => {
    expect(meetsMinAge("2021-03-15", "2026-03-15", 5)).toBe(true);
    expect(meetsMinAge("2021-03-15", "2026-03-14", 5)).toBe(false);
  });

  test("Bruchteile von Jahren (z. B. 0,5 = 6 Monate)", () => {
    expect(minAgeReachedOn("2026-01-31", 0.5)).toBe("2026-07-31");
    // Monatsende: 31.08. + 6 Monate → 28./29.02.
    expect(minAgeReachedOn("2025-08-31", 0.5)).toBe("2026-02-28");
  });

  test("fehlende Angaben blockieren nicht", () => {
    expect(meetsMinAge(null, "2026-01-01", 5)).toBe(true);
    expect(meetsMinAge("2020-01-01", null, 5)).toBe(true);
    expect(meetsMinAge("2020-01-01", "2026-01-01", null)).toBe(true);
  });
});

describe("Höchstalter („bis einschließlich 5 Jahre“)", () => {
  test("bis zum Tag vor dem 6. Geburtstag passt es", () => {
    expect(withinMaxAge("2020-06-10", "2026-06-09", 5)).toBe(true);
    expect(withinMaxAge("2020-06-10", "2026-06-10", 5)).toBe(false);
  });

  test("ohne Höchstalter passt es immer", () => {
    expect(withinMaxAge("1980-01-01", "2026-01-01", null)).toBe(true);
  });
});

describe("Vorschlag für den Kurswunsch", () => {
  const programs = [
    { id: "w", name: "Wasserzeit für Kinder & Eltern", slug: "wasserzeit" },
    { id: "s", name: "Schwimmabzeichen Seepferdchen", slug: "seepferdchen" },
    { id: "e", name: "Erwachsenenschwimmen – sicher schwimmen lernen", slug: "erwachsene" },
  ];

  test("eindeutiger Name wird erkannt", () => {
    expect(matchProgram("Seepferdchen", programs)?.id).toBe("s");
    expect(matchProgram("Wasserzeit", programs)?.id).toBe("w");
  });

  test("ohne Text kein Vorschlag", () => {
    expect(matchProgram("", programs)).toBeNull();
    expect(matchProgram(null, programs)).toBeNull();
  });

  test("nur aus der übergebenen (vorgefilterten) Liste", () => {
    // Die Verwaltung filtert vorher nach Alter; ausgefilterte Angebote dürfen nie vorgeschlagen werden
    const onlyKids = programs.filter((p) => p.id !== "e");
    expect(matchProgram("sicher schwimmen lernen", onlyKids)?.id).not.toBe("e");
  });
});
