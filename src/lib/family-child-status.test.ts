// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  ageYears,
  childStatus,
  concernTargets,
  lastNote,
  suggestedConcerns,
  type ChildBooking,
  type ChildEntry,
} from "./family-child-status";

const entry = (o: Partial<ChildEntry> = {}): ChildEntry => ({
  id: "e1",
  status: "waiting",
  program: null,
  offerCourse: null,
  offerExpiresAt: null,
  availableFrom: null,
  adminNotes: null,
  respondedAt: null,
  createdAt: "2026-10-01T10:00:00Z",
  ...o,
});
const booking = (o: Partial<ChildBooking> = {}): ChildBooking => ({
  id: "b1",
  status: "confirmed",
  course: "Bronze",
  startsOn: "2027-01-17",
  paid: true,
  removedAt: null,
  cancelledAt: null,
  transferredAt: null,
  cancelReason: null,
  createdAt: "2026-11-01T10:00:00Z",
  ...o,
});
const TODAY = "2026-11-26";

describe("childStatus", () => {
  test("Angebot offen", () => {
    const s = childStatus(
      [entry({ status: "offered", program: "Aufbaukurs", offerExpiresAt: "2026-12-03T12:00:00Z" })],
      [],
      TODAY,
    );
    expect(s.sentence).toBe("Warteliste Aufbaukurs – Platz angeboten bis 03.12.2026");
    expect(s.tone).toBe("warn");
  });
  test("Gebucht und bezahlt", () => {
    const s = childStatus([entry({ status: "accepted" })], [booking()], TODAY);
    expect(s.sentence).toBe("Gebucht: Bronze ab 17.01.2027, bezahlt");
    expect(s.tone).toBe("good");
  });
  test("Gebucht, Zahlung offen", () => {
    expect(childStatus([], [booking({ paid: false })], TODAY).sentence).toContain("Zahlung offen");
  });
  test("Wartend, frühestens später", () => {
    const s = childStatus([entry({ availableFrom: "2027-02-01" })], [], TODAY);
    expect(s.sentence).toBe("Warteliste – wartet, frühestens ab 01.02.2027");
  });
  test("Abgemeldet mit Grund aus der Notiz", () => {
    const s = childStatus(
      [
        entry({
          status: "removed",
          adminNotes:
            "[10.10.2026, 11:15:22] Angelegt\n[26.11.2026, 09:30:00] Abgemeldet – Grund: bleibt bei bisheriger Schwimmschule",
        }),
      ],
      [],
      TODAY,
    );
    expect(s.sentence).toBe("Abgemeldet am 26.11.2026: bleibt bei bisheriger Schwimmschule");
    expect(s.active).toBe(false);
  });
  test("Abgesagte Buchung", () => {
    const s = childStatus(
      [],
      [
        booking({
          status: "cancelled",
          cancelledAt: "2026-11-20T10:00:00Z",
          cancelReason: "Umzug",
        }),
      ],
      TODAY,
    );
    expect(s.sentence).toBe("Abgesagt am 20.11.2026: Umzug");
  });
  test("Aus dem Kurs genommen", () => {
    const s = childStatus(
      [],
      [
        booking({
          status: "cancelled",
          removedAt: "2026-11-21T10:00:00Z",
          cancelReason: "Nichtzahlung",
        }),
      ],
      TODAY,
    );
    expect(s.sentence).toBe("Aus dem Kurs genommen am 21.11.2026: Nichtzahlung");
  });
  test("Nichts vorhanden", () => {
    expect(childStatus([], [], TODAY).sentence).toBe("Noch keine Anfrage und keine Buchung.");
  });
});

describe("Anliegen", () => {
  test("Angebot: Absage mit Warten und Abmelden", () => {
    const e = [entry({ status: "offered" })];
    expect(suggestedConcerns(e, [])).toEqual(["decline_stay", "leave"]);
    expect(concernTargets(e, [], "leave")[0]?.kind).toBe("decline_leave");
    expect(concernTargets(e, [], "decline_stay")[0]?.kind).toBe("decline_stay");
  });
  test("Wartend: nur Abmelden", () => {
    const e = [entry()];
    expect(suggestedConcerns(e, [])).toEqual(["leave"]);
    expect(concernTargets(e, [], "leave")[0]?.kind).toBe("unregister");
    expect(concernTargets(e, [], "other_course")).toEqual([]);
  });
  test("Gebucht: anderer Kurs und Absage", () => {
    const b = [booking()];
    expect(suggestedConcerns([], b)).toEqual(["other_course", "leave"]);
    expect(concernTargets([], b, "leave")[0]?.kind).toBe("cancel_booking");
    expect(concernTargets([], b, "other_course")[0]?.kind).toBe("transfer");
  });
  test("Abgemeldet: keine Vorschläge", () => {
    expect(suggestedConcerns([entry({ status: "removed" })], [])).toEqual([]);
  });
});

describe("Hilfen", () => {
  test("lastNote", () => {
    expect(lastNote("[01.02.2026, 10:00] Hallo")).toEqual({ day: "2026-02-01", text: "Hallo" });
    expect(lastNote("")).toBeNull();
  });
  test("ageYears", () => {
    expect(ageYears("2019-12-01", "2026-11-26")).toBe(6);
    expect(ageYears("2019-11-26", "2026-11-26")).toBe(7);
    expect(ageYears(null, "2026-11-26")).toBeNull();
  });
});
