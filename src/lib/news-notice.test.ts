// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { canNotify, newsLink, plainPreview, recipientEmails } from "./news-notice";

describe("News-Hinweis", () => {
  test("nur veröffentlichte öffentliche oder Mitglieder-Beiträge", () => {
    expect(canNotify({ published: true, visibility: "public" })).toBe(true);
    expect(canNotify({ published: true, visibility: "members" })).toBe(true);
    expect(canNotify({ published: true, visibility: "trainers" })).toBe(false);
    expect(canNotify({ published: true, visibility: "admin" })).toBe(false);
    expect(canNotify({ published: false, visibility: "public" })).toBe(false);
  });

  test("Link je Sichtbarkeit", () => {
    expect(newsLink("public")).toContain("/news");
    expect(newsLink("members")).toContain("/portal/news");
  });

  test("Vorschau bevorzugt die Kurzbeschreibung", () => {
    expect(plainPreview("Kurz", "Langer Text")).toBe("Kurz");
  });

  test("Vorschau entfernt HTML und Markdown und kürzt am Wortende", () => {
    const long = `<p>**Hallo** [Link](http://x.de) ${"wort ".repeat(100)}</p>`;
    const p = plainPreview(null, long, 100);
    expect(p).not.toContain("<");
    expect(p).not.toContain("**");
    expect(p).not.toContain("http");
    expect(p.length).toBeLessThanOrEqual(104);
    expect(p.endsWith("…")).toBe(true);
  });

  test("Empfänger: nur aktive, ohne Doppelte, inkl. Erziehungsberechtigte", () => {
    const r = recipientEmails([
      { status: "active", email: "A@x.de", guardian_email: "eltern@x.de" },
      { status: "active", email: "a@x.de ", guardian_email: null },
      { status: "pending", email: "neu@x.de", guardian_email: null },
      { status: "active", email: "kaputt", guardian_email: "" },
    ]);
    expect(r).toEqual(["a@x.de", "eltern@x.de"]);
  });
});
