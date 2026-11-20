// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { proratePrice } from "./prorated-price";

const dates = [
  "2026-11-02",
  "2026-11-09",
  "2026-11-16",
  "2026-11-23",
  "2026-11-30",
  "2026-12-07",
  "2026-12-14",
  "2026-12-21",
  "2027-01-11",
  "2027-01-18",
];

describe("anteiliger Kurspreis", () => {
  test("Kurs noch nicht gestartet: voller Preis", () => {
    const r = proratePrice(200, dates, "2026-10-20");
    expect(r).toMatchObject({ price: 200, prorated: false, past: 0, total: 10 });
  });

  test("3 von 10 Terminen vorbei: 70 %", () => {
    const r = proratePrice(200, dates, "2026-11-20");
    expect(r).toMatchObject({ price: 140, fullPrice: 200, past: 3, total: 10, prorated: true });
  });

  test("Termin am Buchungstag zählt noch mit", () => {
    expect(proratePrice(200, dates, "2026-11-16").past).toBe(2);
    expect(proratePrice(200, dates, "2026-11-16").price).toBe(160);
  });

  test("Mitgliedspreis ist beliebig, Rundung auf Cent", () => {
    expect(proratePrice(159, dates, "2026-11-20").price).toBe(111.3);
    expect(proratePrice(100, dates.slice(0, 3), "2026-11-05").price).toBe(66.67);
  });

  test("keine Termine angelegt oder Kurs schon vorbei: keine Kürzung", () => {
    expect(proratePrice(200, [], "2026-11-20").price).toBe(200);
    expect(proratePrice(200, dates, "2027-03-01").price).toBe(200);
  });

  test("ohne Preis bleibt null", () => {
    expect(proratePrice(null, dates, "2026-11-20").price).toBeNull();
  });
});
