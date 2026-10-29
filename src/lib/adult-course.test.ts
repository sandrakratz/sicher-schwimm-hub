// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  ADULT_COURSE_PRICE_MEMBER,
  ADULT_COURSE_PRICE_NON_MEMBER,
  findPossibleDuplicates,
  interestInputSchema,
  priceOptions,
} from "./adult-course";

const valid = {
  firstName: "Anna",
  lastName: "Muster",
  email: "anna@example.com",
  swimLevel: "cannot",
  saturdayAvailability: "flexible",
  pricePreference: "check_dates",
  privacyAccepted: true,
};

describe("Interessenbekundung Erwachsenenschwimmen", () => {
  test("gültige Pflichtangaben werden akzeptiert, Telefon/Nachricht/Mitgliedsstatus sind optional", () => {
    expect(interestInputSchema.safeParse(valid).success).toBe(true);
  });

  test("fehlende Pflichtangaben werden abgelehnt", () => {
    for (const key of Object.keys(valid)) {
      const { [key]: _omit, ...rest } = valid as Record<string, unknown>;
      expect(interestInputSchema.safeParse(rest).success).toBe(false);
    }
  });

  test("Datenschutz-Einwilligung muss ausdrücklich true sein (nicht vorangekreuzt/leer)", () => {
    expect(interestInputSchema.safeParse({ ...valid, privacyAccepted: false }).success).toBe(false);
  });

  test("ungültige E-Mail und unbekannte Auswahlwerte werden abgelehnt", () => {
    expect(interestInputSchema.safeParse({ ...valid, email: "kein-mail" }).success).toBe(false);
    expect(interestInputSchema.safeParse({ ...valid, swimLevel: "profi" }).success).toBe(false);
    expect(interestInputSchema.safeParse({ ...valid, pricePreference: "free" }).success).toBe(
      false,
    );
  });

  test("gefülltes Honeypot-Feld wird abgelehnt", () => {
    expect(interestInputSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });

  test("Texte sind in der Länge begrenzt", () => {
    expect(interestInputSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe("Preise", () => {
  test("beide Preise werden korrekt beschriftet", () => {
    const o = priceOptions(ADULT_COURSE_PRICE_MEMBER, ADULT_COURSE_PRICE_NON_MEMBER);
    expect(o.member_159).toContain("159 €");
    expect(o.non_member_179).toContain("179 €");
    expect(ADULT_COURSE_PRICE_MEMBER).toBeLessThan(ADULT_COURSE_PRICE_NON_MEMBER);
  });
});

describe("Doppelerkennung", () => {
  const base = { first_name: "A", last_name: "B", phone: null };
  test("gleicher Name oder gleiche Telefonnummer wird markiert", () => {
    const rows = [
      { id: "1", first_name: "Anna", last_name: "Muster", phone: "0178 123456" },
      { id: "2", first_name: "anna", last_name: " muster", phone: null },
      { id: "3", first_name: "Bert", last_name: "Beispiel", phone: "0178/123456" },
      { id: "4", first_name: "Cora", last_name: "Neu", phone: "0222 999999" },
    ];
    const d = findPossibleDuplicates(rows);
    expect([...d].sort()).toEqual(["1", "2", "3"]);
    expect(findPossibleDuplicates([{ id: "x", ...base }]).size).toBe(0);
  });
});
