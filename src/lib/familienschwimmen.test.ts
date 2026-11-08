// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  isLateCancel,
  needsGrandstandSupervision,
  personsFromMemberships,
  proposeAllocation,
  pickNextFromWaitlist,
  validateSelection,
  type AllocRequest,
  type MembershipForSwim,
  type Standing,
} from "./familienschwimmen";

const ev = (id: string, date: string, capacity = 10) => ({ id, date, capacity, usedSeats: 0 });
const req = (
  id: string,
  userId: string,
  eventId: string,
  seats: number,
  t = "2026-11-09T10:00:00Z",
): AllocRequest => ({
  id,
  userId,
  eventId,
  seats,
  requestedAt: t,
});
const st = (participations: number, strikes = 0, last: string | null = null): Standing => ({
  participations,
  strikes,
  pendingConfirmed: 0,
  last_participation: last,
});

describe("Vergabe", () => {
  test("Familie mit weniger Teilnahmen kommt zuerst", () => {
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21", 4)],
      requests: [req("a", "A", "e1", 4), req("b", "B", "e1", 4)],
      standing: { A: st(3), B: st(0) },
    });
    expect(r.confirmed.map((c) => c.requestId)).toEqual(["b"]);
    expect(r.waitlist).toEqual(["a"]);
  });

  test("keine Überbuchung und keine Teilzusage", () => {
    // 12 Personen Bedarf bei 10 Plätzen: A4 B3 C2 D3
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21")],
      requests: [
        req("a", "A", "e1", 4, "2026-11-09T10:00:00Z"),
        req("b", "B", "e1", 3, "2026-11-09T10:01:00Z"),
        req("c", "C", "e1", 2, "2026-11-09T10:02:00Z"),
        req("d", "D", "e1", 3, "2026-11-09T10:03:00Z"),
      ],
      standing: {},
    });
    const seats = r.confirmed.reduce(
      (sum, c) => sum + ({ a: 4, b: 3, c: 2, d: 3 } as Record<string, number>)[c.requestId]!,
      0,
    );
    expect(seats).toBeLessThanOrEqual(10);
    expect(r.confirmed.map((c) => c.requestId)).toEqual(["a", "b", "c"]);
    expect(r.waitlist).toEqual(["d"]);
  });

  test("Strafpunkte lassen eine Familie nach hinten rutschen", () => {
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21", 3)],
      requests: [req("a", "A", "e1", 3), req("b", "B", "e1", 3)],
      standing: { A: st(0, 2), B: st(1) },
    });
    expect(r.confirmed.map((c) => c.requestId)).toEqual(["b"]);
  });

  test("Gleichstand: längere Zeit seit letzter Teilnahme, dann Anmeldezeit", () => {
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21", 3)],
      requests: [req("a", "A", "e1", 3), req("b", "B", "e1", 3)],
      standing: { A: st(1, 0, "2026-10-10"), B: st(1, 0, "2026-06-01") },
    });
    expect(r.confirmed.map((c) => c.requestId)).toEqual(["b"]);

    const r2 = proposeAllocation({
      events: [ev("e1", "2026-11-21", 3)],
      requests: [
        req("a", "A", "e1", 3, "2026-11-09T12:00:00Z"),
        req("b", "B", "e1", 3, "2026-11-09T09:00:00Z"),
      ],
      standing: {},
    });
    expect(r2.confirmed.map((c) => c.requestId)).toEqual(["b"]);
  });

  test("Mehrfachwunsch: erst ein Termin je Familie, dann weitere", () => {
    // Ein Platzblock je Termin (3 Plätze). A wünscht beide Termine, B nur den ersten.
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21", 3), ev("e2", "2026-12-12", 3)],
      requests: [
        req("a1", "A", "e1", 3, "2026-11-09T09:00:00Z"),
        req("a2", "A", "e2", 3, "2026-11-09T09:00:00Z"),
        req("b1", "B", "e1", 3, "2026-11-09T10:00:00Z"),
      ],
      standing: {},
    });
    // Runde 1: A bekommt e1, B scheitert an e1 (voll). Runde 2: A bekommt zusätzlich e2.
    expect(r.confirmed.map((c) => c.requestId)).toEqual(["a1", "a2"]);
    expect(r.waitlist).toEqual(["b1"]);
  });

  test("Eine Familie bekommt nicht alle Termine, wenn andere warten", () => {
    const r = proposeAllocation({
      events: [ev("e1", "2026-11-21", 3), ev("e2", "2026-12-12", 3)],
      requests: [
        req("a1", "A", "e1", 3, "2026-11-09T09:00:00Z"),
        req("a2", "A", "e2", 3, "2026-11-09T09:00:00Z"),
        req("b2", "B", "e2", 3, "2026-11-09T10:00:00Z"),
      ],
      standing: {},
    });
    // Runde 1: A -> e1, B -> e2. Danach ist nichts mehr frei.
    expect(r.confirmed.map((c) => c.requestId).sort()).toEqual(["a1", "b2"]);
    expect(r.waitlist).toEqual(["a2"]);
  });

  test("Ergebnis ist reproduzierbar", () => {
    const input = {
      events: [ev("e1", "2026-11-21", 5)],
      requests: [req("a", "A", "e1", 2), req("b", "B", "e1", 2), req("c", "C", "e1", 2)],
      standing: {},
    };
    expect(proposeAllocation(input)).toEqual(proposeAllocation(input));
  });

  test("Nachrücken: höchste Priorität, aber nur wenn alle Personen passen", () => {
    const waiting = [req("a", "A", "e1", 4), req("b", "B", "e1", 2)];
    expect(pickNextFromWaitlist(2, waiting, { A: st(0), B: st(5) })?.id).toBe("b");
    expect(pickNextFromWaitlist(4, waiting, { A: st(0), B: st(5) })?.id).toBe("a");
    expect(pickNextFromWaitlist(1, waiting, {})).toBeNull();
  });
});

const fam: MembershipForSwim = {
  id: "m1",
  membership_type: "family",
  status: "active",
  first_name: "Anna",
  last_name: "Muster",
  date_of_birth: "1985-05-05",
  family_members: {
    partner: { name: "Ben Muster", date_of_birth: "1984-01-01" },
    children: [{ name: "Cleo Muster", date_of_birth: "2018-03-03" }],
  },
};

describe("Personen und Regeln", () => {
  test("Familienmitgliedschaft liefert alle Familienmitglieder", () => {
    const p = personsFromMemberships([fam], "2026-11-08");
    expect(p.map((x) => x.name)).toEqual(["Anna Muster", "Ben Muster", "Cleo Muster"]);
    expect(p.map((x) => x.role)).toEqual(["adult", "adult", "child"]);
  });

  test("Einzelmitgliedschaft: nur die Person selbst", () => {
    const p = personsFromMemberships(
      [{ ...fam, id: "m2", membership_type: "adult", family_members: null }],
      "2026-11-08",
    );
    expect(p.length).toBe(1);
  });

  test("Fördermitglieder und inaktive Mitgliedschaften sind nicht berechtigt", () => {
    expect(
      personsFromMemberships([{ ...fam, membership_type: "supporting" }], "2026-11-08"),
    ).toEqual([]);
    expect(personsFromMemberships([{ ...fam, status: "pending" }], "2026-11-08")).toEqual([]);
  });

  test("Kind mit Erwachsenem aus der Familie im Wasser braucht keine Tribünenaufsicht", () => {
    const p = personsFromMemberships([fam], "2026-11-08");
    expect(needsGrandstandSupervision([p[0]!, p[2]!])).toBe(false);
    expect(needsGrandstandSupervision([p[2]!])).toBe(true);
  });

  test("Kind allein: Bronze und Aufsichtsperson nötig", () => {
    const p = personsFromMemberships([fam], "2026-11-08");
    const child = [p[2]!];
    expect(
      validateSelection({ selected: child, bronzeConfirmed: false, grandstandName: "" }),
    ).not.toBeNull();
    expect(
      validateSelection({ selected: child, bronzeConfirmed: true, grandstandName: "" }),
    ).not.toBeNull();
    expect(
      validateSelection({ selected: child, bronzeConfirmed: true, grandstandName: "Oma Muster" }),
    ).toBeNull();
  });

  test("Kindermitgliedschaft: immer Bronze und Tribünenaufsicht", () => {
    const kid = personsFromMemberships(
      [
        {
          ...fam,
          id: "m3",
          membership_type: "children_youth",
          first_name: "Dina",
          date_of_birth: "2016-01-01",
          family_members: null,
        },
      ],
      "2026-11-08",
    );
    expect(needsGrandstandSupervision(kid)).toBe(true);
  });

  test("Erwachsener allein darf sich anmelden", () => {
    const p = personsFromMemberships(
      [{ ...fam, membership_type: "adult", family_members: null }],
      "2026-11-08",
    );
    expect(
      validateSelection({ selected: p, bronzeConfirmed: false, grandstandName: "" }),
    ).toBeNull();
  });
});

describe("Absagefrist", () => {
  test("spät = weniger als 48 Stunden vor Beginn", () => {
    expect(isLateCancel("2026-11-21", "12:00", new Date("2026-11-19T10:00:00Z"))).toBe(false);
    expect(isLateCancel("2026-11-21", "12:00", new Date("2026-11-19T12:00:00Z"))).toBe(true);
    expect(isLateCancel("2026-11-21", "12:00", new Date("2026-11-21T08:00:00Z"))).toBe(true);
  });
});
