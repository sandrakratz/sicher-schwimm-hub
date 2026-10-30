// Planungslogik für den Dienstplan (rein rechnerisch, client- und serverseitig nutzbar):
// Besetzung, Lücken, Ersatz-Rangliste und Vorschlag für die Einteilung.

export type PlanSession = {
  id: string;
  courseId: string;
  courseName: string;
  location: string | null;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null; // HH:MM
  index: number;
  /** Benötigte Trainer:innen (Kurseinstellung). */
  needed: number;
  /** Fest zugeordnete Personen (Kurstrainer:in, ältere Einzelzuordnung) – zählen zur Besetzung, nicht entfernbar. */
  fixedIds: string[];
  replacementRequestedAt: string | null;
  /** Kursart (course_programs); null = ohne Zuordnung, dann greift keine Kursart-Bereitschaft. */
  programId?: string | null;
};

/** Grundsätzliche Bereitschaft je Kursart; fehlt ein Eintrag, gilt „geht auch“. */
export type ProgramPref = { trainerId: string; programId: string; preference: "gern" | "nein" };

export type PlanTrainer = { id: string; name: string; email: string };
export type PlanAssignment = {
  sessionId: string;
  trainerId: string;
  /** false = noch nicht bestätigt */ confirmed?: boolean;
};
/** Wunsch der Person: höchstens so viele Einsätze im Monat. */
export type PlanSetting = { trainerId: string; maxPerMonth: number | null };
export type PlanAvailability = { sessionId: string; trainerId: string; available: boolean };
export type PlanBlackout = {
  id: string;
  trainerId: string;
  from: string;
  to: string;
  /** ISO-Wochentage 1 (Mo) … 7 (So); leer = alle Tage. */
  weekdays: number[] | null;
  note: string | null;
};

export type PlanData = {
  sessions: PlanSession[];
  trainers: PlanTrainer[];
  assignments: PlanAssignment[];
  availability: PlanAvailability[];
  blackouts: PlanBlackout[];
  programPrefs?: ProgramPref[];
  settings?: PlanSetting[];
};

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche, in der `date` liegt. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function timeText(s: { start: string | null; end: string | null }): string {
  if (!s.start) return "Zeit offen";
  return s.end ? `${s.start}–${s.end} Uhr` : `${s.start} Uhr`;
}

/** „Kurs · Sa 14.11. · 09:00–09:45 Uhr (3. Termin)“ */
export function sessionLabel(s: PlanSession): string {
  return `${s.courseName} · ${shortDate(s.date)} · ${timeText(s)} (${s.index}. Termin)`;
}

export function blackoutOn(
  blackouts: PlanBlackout[],
  trainerId: string,
  date: string,
): PlanBlackout | undefined {
  const wd = isoWeekday(date);
  return blackouts.find(
    (b) =>
      b.trainerId === trainerId &&
      b.from <= date &&
      date <= b.to &&
      (!b.weekdays || b.weekdays.length === 0 || b.weekdays.includes(wd)),
  );
}

export function blackoutText(b: Pick<PlanBlackout, "from" | "to" | "weekdays" | "note">): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  const range = b.from === b.to ? fmt(b.from) : `${fmt(b.from)} – ${fmt(b.to)}`;
  const days =
    b.weekdays && b.weekdays.length
      ? ` · nur ${[...b.weekdays]
          .sort()
          .map((d) => WEEKDAY_SHORT[d - 1])
          .join(", ")}`
      : "";
  return `${range}${days}${b.note ? ` · ${b.note}` : ""}`;
}

/** Zeitliche Überschneidung zweier Termine; fehlen Uhrzeiten, gilt derselbe Tag vorsichtshalber als Überschneidung. */
export function overlaps(
  a: Pick<PlanSession, "date" | "start" | "end">,
  b: Pick<PlanSession, "date" | "start" | "end">,
): boolean {
  if (a.date !== b.date) return false;
  if (!a.start || !b.start) return true;
  const aEnd = a.end ?? a.start;
  const bEnd = b.end ?? b.start;
  if (a.start === b.start) return true;
  return a.start < bEnd && b.start < aEnd;
}

/** Index, der die Auswertungen schnell macht. */
export function indexPlan(data: PlanData) {
  const teamBySession = new Map<string, Set<string>>();
  for (const s of data.sessions) teamBySession.set(s.id, new Set(s.fixedIds));
  for (const a of data.assignments) teamBySession.get(a.sessionId)?.add(a.trainerId);
  const availBy = new Map<string, boolean>();
  for (const a of data.availability) availBy.set(`${a.sessionId}|${a.trainerId}`, a.available);
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const trainerById = new Map(data.trainers.map((t) => [t.id, t]));
  const sessionsByTrainer = new Map<string, PlanSession[]>();
  for (const [sid, team] of teamBySession) {
    const s = sessionById.get(sid);
    if (!s) continue;
    for (const t of team) sessionsByTrainer.set(t, [...(sessionsByTrainer.get(t) ?? []), s]);
  }
  const prefBy = new Map<string, "gern" | "nein">();
  for (const p of data.programPrefs ?? [])
    prefBy.set(`${p.programId}|${p.trainerId}`, p.preference);
  const maxBy = new Map<string, number>();
  for (const s of data.settings ?? []) if (s.maxPerMonth) maxBy.set(s.trainerId, s.maxPerMonth);
  const unconfirmed = new Set<string>();
  for (const a of data.assignments)
    if (a.confirmed === false) unconfirmed.add(`${a.sessionId}|${a.trainerId}`);
  return {
    teamBySession,
    availBy,
    sessionById,
    trainerById,
    sessionsByTrainer,
    prefBy,
    maxBy,
    unconfirmed,
  };
}

/** Bereitschaft der Person für die Kursart des Termins (undefined = geht auch). */
export function programPref(ix: PlanIndex, s: PlanSession, trainerId: string) {
  return s.programId ? ix.prefBy.get(`${s.programId}|${trainerId}`) : undefined;
}
export type PlanIndex = ReturnType<typeof indexPlan>;

export function gapOf(ix: PlanIndex, s: PlanSession): number {
  return Math.max(0, s.needed - (ix.teamBySession.get(s.id)?.size ?? 0));
}

export type CandidateState = "yes" | "open" | "declined" | "blocked" | "conflict";

export type Candidate = {
  trainer: PlanTrainer;
  state: CandidateState;
  /** Kurztext zur Einordnung, z. B. „zur selben Zeit: Bronze Hennef“. */
  hint: string;
  /** Einsätze im Monat des Termins (ohne diesen). */
  load: number;
  /** Macht diese Kursart ausdrücklich gern. */
  liked?: boolean;
};

const STATE_RANK: Record<CandidateState, number> = {
  yes: 0,
  open: 1,
  conflict: 2,
  declined: 3,
  blocked: 4,
};

export function monthLoad(ix: PlanIndex, trainerId: string, month: string): number {
  return (ix.sessionsByTrainer.get(trainerId) ?? []).filter((s) => s.date.startsWith(month)).length;
}

/** Wer kommt für diesen Termin in Frage? Bereits Eingeteilte fehlen in der Liste. */
export function rankCandidates(data: PlanData, ix: PlanIndex, s: PlanSession): Candidate[] {
  const team = ix.teamBySession.get(s.id) ?? new Set<string>();
  return data.trainers
    .filter((t) => !team.has(t.id))
    .map<Candidate>((t) => {
      const load = monthLoad(ix, t.id, s.date.slice(0, 7));
      const block = blackoutOn(data.blackouts, t.id, s.date);
      if (block) {
        return {
          trainer: t,
          state: "blocked",
          hint: `Sperrzeit${block.note ? `: ${block.note}` : ""}`,
          load,
        };
      }
      const clash = (ix.sessionsByTrainer.get(t.id) ?? []).find(
        (o) => o.id !== s.id && overlaps(o, s),
      );
      const av = ix.availBy.get(`${s.id}|${t.id}`);
      const pref = programPref(ix, s, t.id);
      if (pref === "nein")
        return {
          trainer: t,
          state: "declined",
          hint: "betreut diese Kursart grundsätzlich nicht",
          load,
        };
      if (av === false)
        return { trainer: t, state: "declined", hint: "hat „kann nicht“ gemeldet", load };
      if (clash) {
        return {
          trainer: t,
          state: "conflict",
          hint: `zur selben Zeit: ${clash.courseName}`,
          load,
        };
      }
      const max = ix.maxBy.get(t.id);
      if (max && load >= max) {
        return {
          trainer: t,
          state: "conflict",
          hint: `Wunsch: höchstens ${max} Einsätze im Monat (schon ${load})`,
          load,
        };
      }
      return {
        trainer: t,
        state: av === true ? "yes" : "open",
        hint:
          (av === true ? "hat zugesagt" : "keine Rückmeldung") +
          (pref === "gern" ? " · macht diese Kursart gern" : ""),
        load,
        liked: pref === "gern",
      };
    })
    .sort(
      (a, b) =>
        STATE_RANK[a.state] - STATE_RANK[b.state] ||
        Number(b.liked ?? false) - Number(a.liked ?? false) ||
        a.load - b.load ||
        a.trainer.name.localeCompare(b.trainer.name, "de"),
    );
}

export type Proposal = { sessionId: string; trainerId: string; why: string };
export type Unfilled = { sessionId: string; missing: number };

/**
 * Schlägt vor, wer die Lücken füllt. Bestehende Einteilungen bleiben unberührt. Bevorzugt wird, wer im
 * Kurs schon eingeteilt ist (gleichbleibendes Team), dann wer zugesagt hat, dann wer im Monat am wenigsten
 * Einsätze hat. Sperrzeiten, „kann nicht“ und Überschneidungen werden nie vorgeschlagen.
 */
export function suggestPlan(
  data: PlanData,
  opts: { sessionIds?: Set<string>; includeOpen: boolean },
): { proposals: Proposal[]; unfilled: Unfilled[] } {
  const ix = indexPlan(data);
  // Arbeitskopie der Besetzung, damit Vorschläge sich gegenseitig berücksichtigen
  const team = new Map<string, Set<string>>();
  for (const [k, v] of ix.teamBySession) team.set(k, new Set(v));
  const byTrainer = new Map<string, PlanSession[]>();
  for (const [k, v] of ix.sessionsByTrainer) byTrainer.set(k, [...v]);
  const courseTeam = new Map<string, Set<string>>();
  for (const s of data.sessions)
    for (const t of team.get(s.id) ?? [])
      courseTeam.set(s.courseId, (courseTeam.get(s.courseId) ?? new Set()).add(t));

  const proposals: Proposal[] = [];
  const unfilled: Unfilled[] = [];
  const todo = data.sessions
    .filter((s) => !opts.sessionIds || opts.sessionIds.has(s.id))
    .sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));

  for (const s of todo) {
    const members = team.get(s.id) ?? new Set<string>();
    let missing = Math.max(0, s.needed - members.size);
    while (missing > 0) {
      const scored = data.trainers
        .filter((t) => !members.has(t.id))
        .map((t) => {
          if (blackoutOn(data.blackouts, t.id, s.date)) return null;
          const av = ix.availBy.get(`${s.id}|${t.id}`);
          if (av === false) return null;
          const pref = programPref(ix, s, t.id);
          if (pref === "nein") return null;
          if (av === undefined && !opts.includeOpen) return null;
          if ((byTrainer.get(t.id) ?? []).some((o) => o.id !== s.id && overlaps(o, s))) return null;
          const load = (byTrainer.get(t.id) ?? []).filter((o) =>
            o.date.startsWith(s.date.slice(0, 7)),
          ).length;
          const max = ix.maxBy.get(t.id);
          if (max && load >= max) return null;
          const inTeam = courseTeam.get(s.courseId)?.has(t.id) ?? false;
          return { t, av, load, inTeam, liked: pref === "gern" };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort(
          (a, b) =>
            Number(b.inTeam) - Number(a.inTeam) ||
            Number(b.av === true) - Number(a.av === true) ||
            Number(b.liked) - Number(a.liked) ||
            a.load - b.load ||
            a.t.name.localeCompare(b.t.name, "de"),
        );
      const pick = scored[0];
      if (!pick) break;
      members.add(pick.t.id);
      byTrainer.set(pick.t.id, [...(byTrainer.get(pick.t.id) ?? []), s]);
      courseTeam.set(s.courseId, (courseTeam.get(s.courseId) ?? new Set()).add(pick.t.id));
      proposals.push({
        sessionId: s.id,
        trainerId: pick.t.id,
        why: [
          pick.inTeam ? "bleibt im Team des Kurses" : "",
          pick.av === true ? "hat zugesagt" : "keine Rückmeldung",
          pick.liked ? "macht diese Kursart gern" : "",
          `${pick.load} Einsätze im Monat`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      missing -= 1;
    }
    if (missing > 0) unfilled.push({ sessionId: s.id, missing });
  }
  return { proposals, unfilled };
}
