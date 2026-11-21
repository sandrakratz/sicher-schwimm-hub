// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { mergeCriteria } from "./swim-exams";

const base = { userId: "u1", userName: "Trainerin", today: "2026-11-21" };

describe("mergeCriteria", () => {
  test("übernimmt nur bekannte Teile und setzt Datum und Prüfer:in", () => {
    const res = mergeCriteria({
      ...base,
      levelKey: "seepferdchen",
      previous: {},
      input: { baderegeln: { done: true }, unbekannt: { done: true } },
    });
    expect(Object.keys(res)).toEqual(["baderegeln"]);
    expect(res.baderegeln).toMatchObject({
      done: true,
      date: "2026-11-21",
      by_id: "u1",
      by_name: "Trainerin",
    });
  });

  test("behält Datum und Prüfer:in bereits erfüllter Teile", () => {
    const res = mergeCriteria({
      ...base,
      levelKey: "seepferdchen",
      previous: { baderegeln: { done: true, date: "2026-10-01", by_id: "u0", by_name: "Anna" } },
      input: { baderegeln: { done: true, date: "2026-10-01" } },
    });
    expect(res.baderegeln).toMatchObject({ date: "2026-10-01", by_id: "u0", by_name: "Anna" });
  });

  test("ohne Prüfungsstufe wird nichts gespeichert", () => {
    expect(
      mergeCriteria({ ...base, levelKey: null, previous: {}, input: { x: { done: true } } }),
    ).toEqual({});
  });
});
