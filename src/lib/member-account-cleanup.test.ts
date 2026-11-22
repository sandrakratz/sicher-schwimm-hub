// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { accountCleanupCutoff, expiredMemberUserIds } from "./member-account-cleanup";

describe("Löschung von Mitgliederzugängen nach Kündigung", () => {
  test("Stichtag liegt 30 Tage zurück", () => {
    expect(accountCleanupCutoff("2027-01-30")).toBe("2026-12-31");
    expect(accountCleanupCutoff("2027-01-29")).toBe("2026-12-30");
  });

  test("Konto mit abgelaufener Mitgliedschaft ist löschreif, am Stichtag selbst schon", () => {
    const rows = [{ user_id: "a", valid_until: "2026-12-31" }];
    expect(expiredMemberUserIds(rows, "2026-12-31")).toEqual(["a"]);
    expect(expiredMemberUserIds(rows, "2026-12-30")).toEqual([]);
  });

  test("Ohne „gültig bis“ oder ohne Konto wird nichts gelöscht", () => {
    expect(expiredMemberUserIds([{ user_id: "a", valid_until: null }], "2030-01-01")).toEqual([]);
    expect(
      expiredMemberUserIds([{ user_id: null, valid_until: "2020-01-01" }], "2030-01-01"),
    ).toEqual([]);
  });

  test("Eine weitere gültige Mitgliedschaft desselben Kontos schützt es", () => {
    const rows = [
      { user_id: "a", valid_until: "2025-12-31" },
      { user_id: "a", valid_until: null },
      { user_id: "b", valid_until: "2025-12-31" },
    ];
    expect(expiredMemberUserIds(rows, "2026-06-01")).toEqual(["b"]);
  });
});
