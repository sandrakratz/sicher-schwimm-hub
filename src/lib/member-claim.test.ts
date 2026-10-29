// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { decideMember, priceFor } from "./member-claim";
import { isAdultProgram } from "./adult-course";

const prices = { member: 159, nonMember: 179 };

describe("Mitgliedspreis nur mit bestätigter Mitgliedschaft", () => {
  test("aktives Mitglied im System: Mitgliedspreis, nichts zu prüfen", () => {
    for (const claimed of [true, false]) {
      const d = decideMember({ claimed, verified: true });
      expect(d).toEqual({ isMember: true, check: null });
      expect(priceFor(d.isMember, prices)).toBe(159);
    }
  });

  test("nur Selbstangabe 'Mitglied': Normalpreis und Prüfung durch die Verwaltung", () => {
    for (const verified of [false, null]) {
      const d = decideMember({ claimed: true, verified });
      expect(d.check).toBe("pending");
      expect(d.isMember).toBeNull();
      expect(priceFor(d.isMember, prices)).toBe(179);
    }
  });

  test("keine Angabe, kein Treffer: Normalpreis ohne Prüfung", () => {
    const d = decideMember({ claimed: false, verified: null });
    expect(d).toEqual({ isMember: false, check: null });
    expect(priceFor(d.isMember, prices)).toBe(179);
  });

  test("ungeklärter Status bekommt nie den Mitgliedspreis", () => {
    expect(priceFor(null, prices)).toBe(179);
    expect(priceFor(false, prices)).toBe(179);
  });
});

describe("Kursart", () => {
  test("Angebote ab 18 Jahren gelten als Erwachsenenangebot", () => {
    expect(isAdultProgram({ min_age_years: 18 })).toBe(true);
    expect(isAdultProgram({ min_age_years: 6 })).toBe(false);
    expect(isAdultProgram({ min_age_years: null })).toBe(false);
  });
});
