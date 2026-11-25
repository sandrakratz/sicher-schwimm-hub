// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import {
  activeOn,
  ageGroupLabels,
  ageGroupOf,
  census,
  ageOn,
  badgeStats,
  demandStats,
  personsOf,
  upcomingBirthdays,
  type MembershipRow,
} from "./reports";

describe("Abzeichen-Statistik", () => {
  test("zählt nur bestandene des Jahres, getrennt nach Kurs und extern", () => {
    const s = badgeStats(
      [
        { exam_level: "seepferdchen", goal_reached: true, date: "2026-03-01", source: "kurs" },
        { exam_level: "seepferdchen", goal_reached: true, date: "2026-05-01", source: "extern" },
        { exam_level: "seepferdchen", goal_reached: false, date: "2026-05-01", source: "kurs" },
        { exam_level: "seepferdchen", goal_reached: null, date: "2026-05-01", source: "kurs" },
        { exam_level: "seepferdchen", goal_reached: true, date: "2025-12-31", source: "kurs" },
        { exam_level: null, goal_reached: true, date: "2026-01-01", source: "kurs" },
      ],
      2026,
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      level: "seepferdchen",
      kurs: 1,
      extern: 1,
      gesamt: 2,
      nichtBestanden: 1,
    });
  });
});

const family: MembershipRow = {
  id: "m1",
  first_name: "Anna",
  last_name: "Muster",
  date_of_birth: "1985-12-10",
  email: "familie@example.org",
  membership_type: "family",
  status: "active",
  start_date: "2026-03-01",
  family_members: {
    partner: { name: "Tom Muster", date_of_birth: "1984-01-02", email: null },
    children: [
      { name: "Lena", date_of_birth: "2019-12-01" },
      { name: "Paul Peter Beispiel", date_of_birth: "2025-09-17" },
    ],
  },
};

describe("Personen einer Mitgliedschaft", () => {
  test("Hauptmitglied, Partner:in und Kinder; Nachname vom Hauptmitglied, wenn keiner angegeben", () => {
    const p = personsOf(family);
    expect(p.map((x) => [x.rolle, x.vorname, x.nachname])).toEqual([
      ["Hauptmitglied", "Anna", "Muster"],
      ["Partner:in", "Tom", "Muster"],
      ["Kind", "Lena", "Muster"],
      ["Kind", "Paul Peter", "Beispiel"],
    ]);
    // Kinder bekommen Post über die Eltern
    expect(p[2]!.email).toBe("familie@example.org");
  });
});

describe("Mitgliedschaft am Stichtag", () => {
  test("Beginn, Ende und Status", () => {
    expect(activeOn(family, "2026-03-01")).toBe(true);
    expect(activeOn(family, "2026-02-28")).toBe(false);
    expect(activeOn({ ...family, status: "pending" }, "2026-06-01")).toBe(false);
    expect(
      activeOn({ ...family, status: "terminated", valid_until: "2026-12-31" }, "2026-06-01"),
    ).toBe(true);
    expect(
      activeOn({ ...family, status: "terminated", valid_until: "2026-05-31" }, "2026-06-01"),
    ).toBe(false);
    expect(activeOn({ ...family, status: "terminated", valid_until: null }, "2026-06-01")).toBe(
      false,
    );
  });

  test("Alter in vollen Jahren", () => {
    expect(ageOn("2019-12-01", "2026-11-30")).toBe(6);
    expect(ageOn("2019-12-01", "2026-12-01")).toBe(7);
    expect(ageOn(null, "2026-12-01")).toBeNull();
  });
});

describe("Geburtstage in den nächsten 30 Tagen", () => {
  test("über den Jahreswechsel, sortiert, mit neuem Alter", () => {
    const b = upcomingBirthdays(personsOf(family), "2026-11-25", 40);
    expect(b.map((x) => [x.vorname, x.tag, x.wirdAlt])).toEqual([
      ["Lena", "2026-12-01", 7],
      ["Anna", "2026-12-10", 41],
      ["Tom", "2027-01-02", 43],
    ]);
  });

  test("heute zählt mit, außerhalb des Zeitraums nicht", () => {
    expect(upcomingBirthdays(personsOf(family), "2026-12-10", 0).map((x) => x.vorname)).toEqual([
      "Anna",
    ]);
    expect(upcomingBirthdays(personsOf(family), "2026-12-11", 5)).toHaveLength(0);
  });

  test("29. Februar wird in Nicht-Schaltjahren am 28. gefeiert", () => {
    const leap = personsOf({ ...family, date_of_birth: "2016-02-29", family_members: null });
    expect(upcomingBirthdays(leap, "2027-02-20", 10)[0]!.tag).toBe("2027-02-28");
  });
});

describe("Auslastung und Nachfrage", () => {
  test("je Angebot, nur Kurse mit Start im Jahr", () => {
    const s = demandStats(
      [
        {
          program_id: "sp",
          starts_on: "2026-02-01",
          max_participants: 8,
          confirmed: 8,
          cancelled: 1,
        },
        {
          program_id: "sp",
          starts_on: "2026-09-01",
          max_participants: 8,
          confirmed: 4,
          cancelled: 0,
        },
        {
          program_id: "sp",
          starts_on: "2025-09-01",
          max_participants: 8,
          confirmed: 8,
          cancelled: 0,
        },
      ],
      [
        {
          program_id: "sp",
          created_at: "2026-04-01T10:00:00Z",
          status: "waiting",
          decline_count: 1,
        },
        {
          program_id: "sp",
          created_at: "2025-04-01T10:00:00Z",
          status: "waiting",
          decline_count: 2,
        },
      ],
      2026,
    );
    expect(s[0]).toMatchObject({
      kurse: 2,
      plaetze: 16,
      gebucht: 12,
      auslastung: 75,
      storniert: 1,
      neueAnfragen: 1,
      absagenAngebote: 1,
      wartendJetzt: 2,
    });
  });
});

describe("Bestandsmeldung", () => {
  test("Altersgruppen-Bezeichnungen aus Obergrenzen", () => {
    expect(ageGroupLabels([6, 14, 18])).toEqual(["bis 6", "7–14", "15–18", "19 und älter"]);
  });

  test("Altersgruppe zu einem Alter (Obergrenze einschließlich)", () => {
    expect([0, 6, 7, 18, 19, 80].map((a) => ageGroupOf(a, [18, 6, 14]))).toEqual([
      "bis 6",
      "bis 6",
      "7–14",
      "15–18",
      "19 und älter",
      "19 und älter",
    ]);
  });

  test("zählt alle Personen nach Altersgruppe und Geschlecht, fehlende Angaben getrennt", () => {
    const fam: MembershipRow = {
      ...family,
      gender: "w",
      family_members: {
        partner: { name: "Tom Muster", date_of_birth: "1984-01-02", gender: "m" },
        children: [
          { name: "Lena", date_of_birth: "2019-12-01", gender: "w" },
          { name: "Mo", date_of_birth: "2012-05-05", gender: null },
          { name: "Ohne", date_of_birth: null, gender: "d" },
        ],
      },
    };
    const c = census(personsOf(fam), "2027-01-01", [6, 14, 18]);
    // Lena 7 → 7–14, Mo 14 → 7–14 (ohne Geschlecht), Anna 41 und Tom 42 → 19+
    expect(c.rows.map((r) => [r.gruppe, r.w, r.m, r.d, r.ohne, r.gesamt])).toEqual([
      ["bis 6", 0, 0, 0, 0, 0],
      ["7–14", 1, 0, 0, 1, 2],
      ["15–18", 0, 0, 0, 0, 0],
      ["19 und älter", 1, 1, 0, 0, 2],
    ]);
    expect(c.total.gesamt).toBe(4);
    expect(c.ohneGeschlecht.map((p) => p.vorname)).toEqual(["Mo"]);
    expect(c.ohneGeburtsdatum.map((p) => p.vorname)).toEqual(["Ohne"]);
  });
});
