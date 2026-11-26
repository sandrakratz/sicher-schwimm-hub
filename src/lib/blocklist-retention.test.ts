// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  blocklistExpiringSoon,
  blocklistExpiry,
  blocklistExtendedUntil,
} from "./blocklist-retention";

describe("Sperrliste: Aufbewahrung", () => {
  test("ohne Verlängerung: 2 Jahre nach Eintrag", () => {
    expect(blocklistExpiry("2025-03-10T09:00:00Z", null)).toBe("2027-03-10");
  });

  test("Verlängerung gilt vor der Regel", () => {
    expect(blocklistExpiry("2025-03-10T09:00:00Z", "2028-01-31")).toBe("2028-01-31");
  });

  test("Erinnerung 4 Wochen vorher, nicht früher", () => {
    expect(blocklistExpiringSoon("2027-03-10", "2027-02-10")).toBe(true);
    expect(blocklistExpiringSoon("2027-03-10", "2027-02-09")).toBe(false);
    expect(blocklistExpiringSoon("2027-03-10", "2027-03-10")).toBe(true);
    expect(blocklistExpiringSoon("2027-03-10", "2027-03-11")).toBe(false);
  });

  test("Verlängern: heute plus 2 Jahre", () => {
    expect(blocklistExtendedUntil("2026-11-27")).toBe("2028-11-27");
  });
});
