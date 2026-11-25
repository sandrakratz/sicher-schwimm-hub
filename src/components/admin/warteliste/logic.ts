// Reine Logik der Anfrageliste (Warteliste) in der Verwaltung: Typen, Status-Texte und die
// Auswertungen für „Heute“ und die Reiter. Ohne React, damit beide Ansichten dieselben Regeln nutzen.
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import { checkFit } from "@/lib/swim-fit";
import type { listWaitlist } from "@/lib/waitlist.functions";

export type WaitlistData = Awaited<ReturnType<typeof listWaitlist>>;
export type WaitlistEntry = WaitlistData["entries"][number];
export type WaitlistCourse = WaitlistData["courses"][number];
export type WaitlistProgram = WaitlistData["programs"][number];

export type TodayView = "waiting" | "offered" | "followup" | "declined" | "done" | "report";
export type AdminView = "today" | TodayView;

/** Einzelbereich, der von einer Kachel geöffnet wird (statt der Kachelübersicht). */
export type TodayOnly = "fit" | "due" | "suggestions" | "expiring" | "free" | "new" | "min";

/** Warum wartet ein Eintrag? aktuell / Voraussetzung nicht erfüllt / auf Elternwunsch später. */
export type WaitingKind = "now" | "unmet" | "later";

export const WAITING_KIND_LABEL: Record<WaitingKind, string> = {
  now: "wartet auf einen Platz",
  unmet: "Voraussetzung nicht erfüllt",
  later: "später gewünscht",
};

/** Sperrvorschlag ab 3 Absagen/Stornierungen, je E-Mail bzw. Kind. */
export type Suggestion = {
  key: string;
  childName: string | null;
  email: string | null;
  total: number;
};

/** Status-Texte der Tabelle (Reiter). */
export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  waiting: { label: "Wartend", className: "bg-amber-100 text-amber-900" },
  offered: { label: "Platz angeboten", className: "bg-blue-100 text-blue-900" },
  accepted: { label: "Zugesagt", className: "bg-emerald-100 text-emerald-900" },
  declined: { label: "Abgesagt", className: "bg-slate-200 text-slate-800" },
  expired: { label: "Frist abgelaufen", className: "bg-slate-200 text-slate-800" },
  removed: { label: "Entfernt", className: "bg-slate-200 text-slate-800" },
};

/** Kurze Status-Wörter in „Heute“. */
export const STATUS_WORD: Record<string, string> = {
  waiting: "wartend",
  offered: "Angebot offen",
  accepted: "gebucht",
  declined: "abgesagt",
  expired: "Frist abgelaufen",
  removed: "entfernt",
};

/** Farbe des Status-Badges: gelb wartend, blau Angebot offen, grün gebucht, rot abgesagt/entfernt. */
export const STATUS_TONE: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-900",
  offered: "bg-blue-100 text-blue-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-900",
  removed: "bg-red-100 text-red-900",
};

export const PAYMENT_LABEL: Record<string, { label: string; className: string }> = {
  none: { label: "Nicht gebucht", className: "bg-slate-100 text-slate-700" },
  open: { label: "Offen", className: "bg-amber-100 text-amber-900" },
  overdue: { label: "Überfällig", className: "bg-red-100 text-red-900" },
  paid: { label: "Bezahlt", className: "bg-emerald-100 text-emerald-900" },
};

/** Absage-Zähler: 1× grau, 2× gelb, ab 3× rot. */
export function declineTone(n: number): string {
  if (n >= 3) return "bg-red-100 text-red-900";
  if (n === 2) return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

export const programOf = (programs: WaitlistProgram[], id: string | null | undefined) =>
  programs.find((p) => p.id === id) ?? null;

/** Gehört der Kurs zum gewünschten Angebot (oder hat der Eintrag keinen Wunsch)? */
export const courseFitsEntry = (
  e: WaitlistEntry,
  c: { program_id: string | null },
  programs: WaitlistProgram[],
) => !e.program_id || relatedProgramIds(c.program_id, programs).includes(e.program_id);

/** In welchem Reiter steht ein Eintrag? */
export function inView(e: WaitlistEntry, v: AdminView): boolean {
  switch (v) {
    case "waiting":
      return e.status === "waiting";
    case "offered":
      return e.status === "offered";
    case "followup":
      return ["declined", "expired"].includes(e.status);
    // Nachhalte-Liste: jeder Eintrag mit mindestens einer Absage, egal in welchem Status
    case "declined":
      return e.decline_count > 0;
    default:
      return !["waiting", "offered", "declined", "expired"].includes(e.status);
  }
}

/** Letzte Aktion der Eltern an einem Wartelisten-Eintrag: Eintrag, Rückmeldung oder Online-Buchung. */
export function parentActionOf(e: WaitlistEntry): {
  at: string;
  what: string;
  detail: string | null;
} {
  const lastNote =
    (e.admin_notes ?? "")
      .split("\n")
      .map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim())
      .filter(Boolean)
      .pop() ?? null;
  let best = {
    at: e.created_at,
    what: "Auf die Warteliste eingetragen",
    detail: null as string | null,
  };
  if (
    e.responded_at &&
    ["waiting", "removed", "accepted"].includes(e.status) &&
    e.responded_at > best.at
  )
    best = { at: e.responded_at, what: "Rückmeldung der Familie", detail: lastNote };
  if (e.booking?.online && e.booking.booked_at && e.booking.booked_at > best.at)
    best = { at: e.booking.booked_at, what: "Online gebucht", detail: null };
  return best;
}

export function waitingKindOf(e: WaitlistEntry, data: WaitlistData | undefined): WaitingKind {
  if (e.available_from && e.available_from > todayBerlinIso()) return "later";
  const program = programOf(data?.programs ?? [], e.program_id);
  if (program && !checkFit(e.notes, program).ok) return "unmet";
  return "now";
}

/**
 * „Passt das?“: Gibt es für einen wartenden Eintrag freie Plätze, aber keiner davon besteht die
 * Prüfung (Schwimmniveau)? Dann wird nie automatisch angeboten; die Gründe stehen hier.
 * `null` = nichts zu prüfen (kein freier Platz oder mindestens ein Kurs passt).
 */
export function fitProblems(e: WaitlistEntry, data: WaitlistData | undefined): string[] | null {
  // Ohne Kursangebot gibt es keine Vorgabe, gegen die man prüfen könnte – solche Einträge
  // stehen gesondert („Wartende ohne Kursangebot“) und werden von Hand zugeordnet.
  if (e.status !== "waiting" || !data || !e.program_id) return null;
  const today = todayBerlinIso();
  const af = e.available_from;
  const candidates = data.courses.filter(
    (c) =>
      c.free != null &&
      c.free > 0 &&
      !(c.starts_on && c.starts_on <= today) &&
      !(af && c.starts_on && c.starts_on < af) &&
      courseFitsEntry(e, c, data.programs),
  );
  if (candidates.length === 0) return null;
  const issues = new Set<string>();
  for (const c of candidates) {
    const fit = checkFit(e.notes, programOf(data.programs, c.program_id));
    if (fit.ok) return null;
    fit.issues.forEach((i) => issues.add(i));
  }
  return [...issues];
}

const isToday = (iso: string) =>
  formatDateBerlin(iso) === formatDateBerlin(new Date().toISOString());

/** Alles, was in „Heute“ gezählt und aufgelistet wird. */
export function buildTodo(
  data: WaitlistData | undefined,
  assignee = "",
  rules?: { waitlist?: string },
) {
  // Zuständigkeitsfilter gilt für Einträge der Anfrageliste (nicht für Sperrvorschläge und Kurse)
  const entries = (data?.entries ?? []).filter((e) => {
    // Ausdrückliche Zuweisung vor Standard-Zuständigkeit des Bereichs
    const who = e.assigned_to || rules?.waitlist || "";
    return assignee === "" ? true : assignee === "__none" ? !who : who === assignee;
  });
  const todayIso = todayBerlinIso();
  const courses = data?.courses ?? [];
  const programs = data?.programs ?? [];
  const now = Date.now();
  const in48h = now + 48 * 3600 * 1000;
  const weekAgo = now - 7 * 24 * 3600 * 1000;

  const suggestionMap = new Map<string, Suggestion>();
  const addSuggestion = (childName: string | null, email: string | null, total: number) => {
    const key = (email ?? childName ?? "").trim().toLowerCase();
    if (!key) return;
    const prev = suggestionMap.get(key);
    if (!prev || prev.total < total) suggestionMap.set(key, { key, childName, email, total });
  };
  for (const e of entries)
    if (e.block_suggestion && e.decline_count > 0)
      addSuggestion(e.child_name, e.parent_email, e.declines_total);
  for (const c of data?.cancellations ?? [])
    if (c.block_suggestion) addSuggestion(c.child_name, c.parent_email, c.declines_total);

  const expiringOffers = entries
    .filter(
      (e) =>
        e.status === "offered" &&
        !!e.offer_expires_at &&
        new Date(e.offer_expires_at).getTime() < in48h,
    )
    .sort((a, b) => String(a.offer_expires_at).localeCompare(String(b.offer_expires_at)));

  const followups = entries
    .filter((e) => ["declined", "expired"].includes(e.status))
    .sort((a, b) => (a.followup_expires_at ?? "").localeCompare(b.followup_expires_at ?? ""));

  const waiting = entries.filter((e) => e.status === "waiting");
  const freeCourses = courses
    .filter((c) => c.free != null && c.free > 0)
    .map((c) => {
      const families = waiting
        .filter(
          (e) =>
            !!e.program_id &&
            courseFitsEntry(e, c, programs) &&
            (!e.available_from || !c.starts_on || c.starts_on >= e.available_from) &&
            checkFit(e.notes, programOf(programs, c.program_id)).ok,
        )
        .sort(
          (a, b) =>
            Number(b.is_member === true) - Number(a.is_member === true) ||
            a.created_at.localeCompare(b.created_at),
        );
      return { course: c, waiting: families.length, families };
    })
    .filter((x) => x.waiting > 0);

  // Alle Eingänge der Woche, egal in welchem Status (z. B. sofort gebucht oder angeboten)
  const newEntries = entries
    .filter((e) => new Date(parentActionOf(e).at).getTime() >= weekAgo)
    .sort((a, b) => parentActionOf(b).at.localeCompare(parentActionOf(a).at));
  const newToday = newEntries.filter((e) => isToday(parentActionOf(e).at));
  // Weitere Aktionen der Eltern: Kursanfragen, Nachrichten, Mitgliedsanträge, Volljährigkeits-Bestätigungen
  const newOther = (data?.activity ?? []).filter((a) => new Date(a.at).getTime() >= weekAgo);
  const newOtherToday = newOther.filter((a) => isToday(a.at));
  // Direktbuchungen über die Website (kein Wartelisten-Eintrag), nicht vom Zuständigkeitsfilter betroffen
  const newDirect = (data?.directBookings ?? []).filter(
    (b) => new Date(b.created_at).getTime() >= weekAgo,
  );
  const newDirectToday = newDirect.filter((b) => isToday(b.created_at));
  const newUnassigned = newEntries.filter((e) => !(e.assigned_to || rules?.waitlist));

  const waitNoProgram = waiting.filter((e) => !e.program_id);
  const waitByKind: Record<WaitingKind, WaitlistEntry[]> = { now: [], unmet: [], later: [] };
  for (const e of waiting) waitByKind[waitingKindOf(e, data)].push(e);

  const fitChecks = waiting
    .map((e) => ({ e, issues: fitProblems(e, data) }))
    .filter((x): x is { e: WaitlistEntry; issues: string[] } => !!x.issues);
  const dueFollowUps = entries
    .filter(
      (e) =>
        !!e.follow_up_on &&
        e.follow_up_on <= todayIso &&
        !["removed", "accepted"].includes(e.status),
    )
    .sort((a, b) => String(a.follow_up_on).localeCompare(String(b.follow_up_on)));

  // Kurse, die noch starten und die Mindestteilnehmerzahl (noch) nicht erreicht haben
  const minCourses = courses
    .filter(
      (c) =>
        c.min_participants != null &&
        c.status !== "completed" &&
        (!c.starts_on || c.starts_on >= todayIso) &&
        c.confirmed < c.min_participants,
    )
    .sort((a, b) => String(a.starts_on ?? "9999").localeCompare(String(b.starts_on ?? "9999")));
  const suggestions = [...suggestionMap.values()];
  return {
    suggestions,
    expiringOffers,
    followups,
    freeCourses,
    minCourses,
    newEntries,
    newToday,
    newDirect,
    newDirectToday,
    newOther,
    newOtherToday,
    newUnassigned,
    waitNow: waitByKind.now,
    waitUnmet: waitByKind.unmet,
    waitLater: waitByKind.later,
    waitNoProgram,
    dueFollowUps,
    fitChecks,
    count:
      suggestions.length +
      expiringOffers.length +
      followups.length +
      freeCourses.length +
      dueFollowUps.length +
      fitChecks.length,
  };
}

export type Todo = ReturnType<typeof buildTodo>;
