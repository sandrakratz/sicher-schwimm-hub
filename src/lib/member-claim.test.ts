// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { decideMember, maxMembershipStart, membershipValidOn, priceFor } from "./member-claim";
import { isAdultProgram } from "./adult-course";
import { firstYearFee } from "./billing-config";

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

describe("Mitgliedschaft: Beginn und Ende der Gültigkeit", () => {
  test("ohne Datum: durchgehend gültig", () => {
    expect(membershipValidOn({}, "2026-03-01")).toBe(true);
  });
  test("Kurs nach Beginn: gültig, Kurs vor Beginn: nicht", () => {
    const m = { start_date: "2026-07-01" };
    expect(membershipValidOn(m, "2026-07-01")).toBe(true);
    expect(membershipValidOn(m, "2026-06-30")).toBe(false);
  });
  test("nach Kündigung zum Jahresende: Kurs im Folgejahr ohne Vergünstigung", () => {
    const m = { start_date: "2026-01-01", valid_until: "2026-12-31" };
    expect(membershipValidOn(m, "2026-12-31")).toBe(true);
    expect(membershipValidOn(m, "2027-01-10")).toBe(false);
  });
  test("spätester Beginn: 6 Monate im Voraus", () => {
    expect(maxMembershipStart("2026-11-20")).toBe("2027-05-20");
  });
});

describe("Beitrag im Beitrittsjahr", () => {
  test("Eintritt bis einschließlich 1. Juli: voller Beitrag", () => {
    expect(firstYearFee("family", "2026-07-01")).toEqual({
      annual: 96,
      firstYear: 96,
      half: false,
    });
  });
  test("Eintritt nach dem 1. Juli: halber Beitrag", () => {
    expect(firstYearFee("adult", "2026-07-02")).toEqual({ annual: 60, firstYear: 30, half: true });
  });
});
