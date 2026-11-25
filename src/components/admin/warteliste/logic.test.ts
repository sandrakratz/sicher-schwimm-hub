// @ts-expect-error bun:test liefert hier keine Typdeklarationen; Ausführung: bun test
import { describe, expect, test } from "bun:test";
import { addDaysIso, todayBerlinIso } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import {
  buildTodo,
  courseFitsEntry,
  fitProblems,
  waitingKindOf,
  type WaitlistData,
  type WaitlistEntry,
} from "./logic";

// Reine Logik der Anfrageliste (Eingang „Passt das?“, freie Plätze, Wartende ohne Kursangebot …).
const today = todayBerlinIso();
const inDays = (n: number) => addDaysIso(today, n);

const programs = [
  { id: "wz", name: "Wasserzeit für Kinder & Eltern", slug: "wasserzeit", min_swim_level: null },
  { id: "sp", name: "Schwimmabzeichen Seepferdchen", slug: "seepferdchen", min_swim_level: 3 },
  { id: "ab", name: "Aufbaukurs", slug: "schwimmabzeichen-aufbaukurs", min_swim_level: 3 },
  { id: "br", name: "Bronze", slug: "bronze", min_swim_level: 3 },
];

function entry(over: Partial<Record<string, unknown>> = {}): WaitlistEntry {
  return {
    id: "e1",
    status: "waiting",
    program_id: "sp",
    notes: "Schwimmlevel: Seepferdchen",
    available_from: null,
    created_at: "2026-01-01T10:00:00Z",
    responded_at: null,
    admin_notes: null,
    booking: null,
    is_member: false,
    assigned_to: null,
    offer_expires_at: null,
    offer_course_id: null,
    follow_up_on: null,
    decline_count: 0,
    declines_total: 0,
    block_suggestion: false,
    child_name: "Kind",
    parent_email: "eltern@example.org",
    ...over,
  } as unknown as WaitlistEntry;
}

function course(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    name: "Seepferdchen Kurs",
    program_id: "sp",
    starts_on: inDays(30),
    free: 2,
    confirmed: 6,
    held: 0,
    min_participants: null,
    max_participants: 8,
    status: "planned",
    ...over,
  };
}

function data(entries: WaitlistEntry[], courses = [course()]): WaitlistData {
  return {
    entries,
    courses,
    programs,
    cancellations: [],
    activity: [],
    directBookings: [],
    staff: [],
  } as unknown as WaitlistData;
}

describe("Kurs passt zum Kurswunsch", () => {
  test("gleiches Angebot passt, anderes nicht", () => {
    expect(courseFitsEntry(entry(), course(), programs as never)).toBe(true);
    expect(courseFitsEntry(entry({ program_id: "wz" }), course(), programs as never)).toBe(false);
  });

  test("Mischkurs Aufbaukurs nimmt Bronze-Wartende auf", () => {
    expect(relatedProgramIds("ab", programs)).toContain("br");
    expect(
      courseFitsEntry(entry({ program_id: "br" }), course({ program_id: "ab" }), programs as never),
    ).toBe(true);
  });
});

describe("„Passt das?“ (fitProblems)", () => {
  test("passendes Niveau → nichts zu prüfen", () => {
    expect(fitProblems(entry(), data([entry()]))).toBeNull();
  });

  test("zu niedriges Niveau bei freiem Platz → Begründung", () => {
    const e = entry({ notes: "Schwimmlevel: Erste Schwimmversuche" });
    expect(fitProblems(e, data([e]))?.[0]).toContain("unter dem Mindest-Niveau");
  });

  test("kein freier Platz → nichts zu prüfen", () => {
    const e = entry({ notes: "" });
    expect(fitProblems(e, data([e], [course({ free: 0 })]))).toBeNull();
  });

  test("Kurs hat schon begonnen → zählt nicht", () => {
    const e = entry({ notes: "" });
    expect(fitProblems(e, data([e], [course({ starts_on: today })]))).toBeNull();
  });

  test("Zurückgestellt: nur Kurse ab dem Datum zählen", () => {
    const e = entry({ notes: "", available_from: inDays(60) });
    expect(fitProblems(e, data([e]))).toBeNull();
  });

  test("Eintrag ohne Kurswunsch wird NICHT gegen alle Kurse geprüft (Fall Ben Liam)", () => {
    const baby = entry({ program_id: null, notes: "Schwimmlevel: Keine Wassererfahrung" });
    expect(fitProblems(baby, data([baby]))).toBeNull();
  });
});

describe("Eingang: Aufgaben aus der Anfrageliste (buildTodo)", () => {
  test("Wartende ohne Kursangebot stehen gesondert und nicht bei freien Plätzen", () => {
    const baby = entry({ id: "b", program_id: null, notes: "" });
    const t = buildTodo(data([baby]));
    expect(t.waitNoProgram.map((e) => e.id)).toEqual(["b"]);
    expect(t.fitChecks).toHaveLength(0);
    expect(t.freeCourses).toHaveLength(0);
  });

  test("freie Plätze mit passender Familie; Mitglieder zuerst", () => {
    const a = entry({ id: "a", created_at: "2026-01-01T00:00:00Z" });
    const m = entry({ id: "m", created_at: "2026-02-01T00:00:00Z", is_member: true });
    const t = buildTodo(data([a, m]));
    expect(t.freeCourses).toHaveLength(1);
    expect(t.freeCourses[0]!.families.map((e) => e.id)).toEqual(["m", "a"]);
  });

  test("Angebote, die in 48 Stunden ablaufen", () => {
    const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const later = new Date(Date.now() + 96 * 3600 * 1000).toISOString();
    const t = buildTodo(
      data([
        entry({ id: "x", status: "offered", offer_expires_at: soon }),
        entry({ id: "y", status: "offered", offer_expires_at: later }),
      ]),
    );
    expect(t.expiringOffers.map((e) => e.id)).toEqual(["x"]);
  });

  test("Wiedervorlage fällig ab dem Tag, nicht bei erledigten Einträgen", () => {
    const t = buildTodo(
      data([
        entry({ id: "due", follow_up_on: today }),
        entry({ id: "future", follow_up_on: inDays(3) }),
        entry({ id: "done", follow_up_on: today, status: "accepted" }),
      ]),
    );
    expect(t.dueFollowUps.map((e) => e.id)).toEqual(["due"]);
  });

  test("Kurse unter der Mindestzahl, die noch starten", () => {
    const t = buildTodo(
      data(
        [],
        [
          course({ id: "k1", min_participants: 7, confirmed: 5 }),
          course({ id: "k2", min_participants: 7, confirmed: 7 }),
          course({ id: "k3", min_participants: 7, confirmed: 2, status: "completed" }),
        ],
      ),
    );
    expect(t.minCourses.map((c) => c.id)).toEqual(["k1"]);
  });

  test("Zuständigkeitsfilter: ausdrückliche Zuweisung vor Standard-Zuständigkeit", () => {
    const mine = entry({ id: "mine", assigned_to: "Sandra", notes: "" });
    const rule = entry({ id: "rule", notes: "" });
    const d = data([mine, rule]);
    expect(buildTodo(d, "Sandra", { waitlist: "Michael" }).fitChecks.map((x) => x.e.id)).toEqual([
      "mine",
    ]);
    expect(buildTodo(d, "Michael", { waitlist: "Michael" }).fitChecks.map((x) => x.e.id)).toEqual([
      "rule",
    ]);
  });
});

describe("Warum wartet ein Eintrag?", () => {
  test("zurückgestellt → später; Niveau passt nicht → Voraussetzung; sonst wartet", () => {
    const d = data([]);
    expect(waitingKindOf(entry({ available_from: inDays(10) }), d)).toBe("later");
    expect(waitingKindOf(entry({ notes: "Schwimmlevel: Erste Schwimmversuche" }), d)).toBe("unmet");
    expect(waitingKindOf(entry(), d)).toBe("now");
  });
});
