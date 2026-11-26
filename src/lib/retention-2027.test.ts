// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { retentionReviewDue } from "./retention-2027";

describe("Erinnerung Löschjob", () => {
  test("erst ab dem 10.02.2027", () => {
    expect(retentionReviewDue("2027-02-09", false)).toBe(false);
    expect(retentionReviewDue("2027-02-10", false)).toBe(true);
  });

  test("verschwindet, sobald der Job echt gelaufen ist", () => {
    expect(retentionReviewDue("2027-03-01", true)).toBe(false);
  });
});
