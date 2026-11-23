// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  addDaysIso,
  formatDateBerlin,
  formatDateTimeBerlin,
  formatDuration,
  formatEuro,
  formatMonthYear,
  formatPrice,
  formatWeekdayLong,
  formatWeekdayShort,
  fullName,
  todayBerlinIso,
} from "./format";

// Intl setzt zwischen Betrag und € ein geschütztes Leerzeichen.
const NB = " ";

describe("Datum", () => {
  test("reiner Kalendertag und Zeitstempel in Berliner Zeit", () => {
    expect(formatDateBerlin("2026-01-05")).toBe("05.01.2026");
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(formatDateBerlin("2026-01-05T23:30:00Z")).toBe("06.01.2026");
    expect(formatDateBerlin(new Date(Date.UTC(2026, 6, 1, 10)))).toBe("01.07.2026");
  });
  test("leer → Strich, ungültig → Eingabe unverändert", () => {
    expect(formatDateBerlin(null)).toBe("—");
    expect(formatDateBerlin("")).toBe("—");
    expect(formatDateBerlin("demnächst")).toBe("demnächst");
  });
  test("mit Uhrzeit (Sommer- und Winterzeit)", () => {
    expect(formatDateTimeBerlin("2026-01-05T13:30:00Z")).toBe("05.01.2026, 14:30");
    expect(formatDateTimeBerlin("2026-07-05T13:30:00Z")).toBe("05.07.2026, 15:30");
    expect(formatDateTimeBerlin(undefined)).toBe("—");
  });
  test("Wochentag kurz und lang", () => {
    expect(formatWeekdayShort("2026-01-05")).toBe("Mo., 05.01.");
    expect(formatWeekdayLong("2026-01-05")).toBe("Montag, 05.01.2026");
    expect(formatWeekdayLong("2026-03-29")).toBe("Sonntag, 29.03.2026");
    expect(formatWeekdayShort("kaputt")).toBe("kaputt");
  });
  test("Monat und Jahr aus YYYY-MM oder YYYY-MM-DD", () => {
    expect(formatMonthYear("2026-03")).toBe("März 2026");
    expect(formatMonthYear("2026-12-31")).toBe("Dezember 2026");
  });
  test("heute im Format YYYY-MM-DD", () => {
    expect(todayBerlinIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  test("Tage verschieben über Monats-, Jahres- und Zeitumstellungsgrenzen", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysIso("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("Beträge", () => {
  test("formatEuro: immer mit Cent und Tausenderpunkt", () => {
    expect(formatEuro(85)).toBe(`85,00${NB}€`);
    expect(formatEuro(42.5)).toBe(`42,50${NB}€`);
    expect(formatEuro(1234.5)).toBe(`1.234,50${NB}€`);
    expect(formatEuro("12.3")).toBe(`12,30${NB}€`);
    expect(formatEuro(-5)).toBe(`-5,00${NB}€`);
  });
  test("formatEuro: leer oder ungültig → Strich", () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatEuro(undefined)).toBe("—");
    expect(formatEuro("")).toBe("—");
    expect(formatEuro("abc")).toBe("—");
  });
  test("formatPrice: ganze Euro, leer → null", () => {
    expect(formatPrice(85)).toBe(`85${NB}€`);
    expect(formatPrice(1200)).toBe(`1.200${NB}€`);
    expect(formatPrice(null)).toBeNull();
  });
});

describe("Texte", () => {
  test("Kursdauer: reine Zahl bekommt „Wochen“", () => {
    expect(formatDuration("8")).toBe("8 Wochen");
    expect(formatDuration(10)).toBe("10 Wochen");
    expect(formatDuration(" 10 Termine ")).toBe("10 Termine");
    expect(formatDuration("")).toBeNull();
    expect(formatDuration(null)).toBeNull();
  });
  test("Name aus Vor- und Nachname", () => {
    expect(fullName("Max", "Muster")).toBe("Max Muster");
    expect(fullName("Max", null)).toBe("Max");
    expect(fullName(undefined, " Muster ")).toBe("Muster");
    expect(fullName(null, "")).toBe("");
  });
});
