// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { checkFit, levelOf, levelTextFromNotes } from "./swim-fit";

describe("Schwimmniveau aus dem Formular", () => {
  test("Formularangaben werden der richtigen Stufe zugeordnet", () => {
    expect(levelOf("Keine Wassererfahrung")).toBe(0);
    expect(levelOf("Wassergewöhnt, kann nicht schwimmen")).toBe(1);
    expect(levelOf("Erste Schwimmversuche")).toBe(2);
    expect(levelOf("Seepferdchen")).toBe(3);
    expect(levelOf("Sicherer Schwimmer")).toBe(4);
    expect(levelOf("Bronze")).toBe(5);
    expect(levelOf("Silber")).toBe(6);
    expect(levelOf("Gold")).toBe(7);
  });

  test("leer oder unbekannt = null", () => {
    expect(levelOf("")).toBeNull();
    expect(levelOf(null)).toBeNull();
    expect(levelOf("weiß nicht")).toBeNull();
  });

  test("Niveau steht in der Zeile „Schwimmlevel:“ der Anmerkungen", () => {
    expect(levelTextFromNotes("Schwimmlevel: Seepferdchen\nBitte vormittags")).toBe("Seepferdchen");
    expect(levelTextFromNotes("Hallo\nSchwimmniveau: Bronze")).toBe("Bronze");
    expect(levelTextFromNotes("nur Freitext")).toBeNull();
  });
});

describe("„Passt das?“", () => {
  const seepferdchen = { name: "Seepferdchen", min_swim_level: 3 };

  test("ohne Programm oder ohne Mindest-Niveau passt alles", () => {
    expect(checkFit("Schwimmlevel: Keine Wassererfahrung", null).ok).toBe(true);
    expect(checkFit("", { min_swim_level: null }).ok).toBe(true);
    expect(checkFit("", { min_swim_level: 0 }).ok).toBe(true);
  });

  test("Niveau erreicht oder höher passt", () => {
    expect(checkFit("Schwimmlevel: Seepferdchen", seepferdchen).ok).toBe(true);
    expect(checkFit("Schwimmlevel: Bronze", seepferdchen).ok).toBe(true);
  });

  test("Niveau zu niedrig oder unbekannt passt nicht – mit Begründung", () => {
    const low = checkFit("Schwimmlevel: Erste Schwimmversuche", seepferdchen);
    expect(low.ok).toBe(false);
    expect(low.issues[0]).toContain("unter dem Mindest-Niveau");
    const unknown = checkFit("Bitte nur samstags", seepferdchen);
    expect(unknown.ok).toBe(false);
    expect(unknown.issues[0]).toContain("unbekannt");
  });

  test("Wochentage spielen keine Rolle mehr (Wunschtag entfällt)", () => {
    const fit = checkFit("Schwimmlevel: Seepferdchen\nWunschtag: Sonntag\nnur sonntags", {
      ...seepferdchen,
      weekday: 6,
    } as never);
    expect(fit).toEqual({ ok: true, issues: [] });
  });
});
