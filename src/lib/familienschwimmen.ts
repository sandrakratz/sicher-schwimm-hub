// Familienschwimmen: Regeln, Priorität und Vergabevorschlag (reine Logik, ohne Datenbank).
// Der Server prüft und vergibt damit; die Plätze selbst werden atomar in der Datenbank
// (family_swim_confirm) gesetzt, hier entsteht nur der nachvollziehbare Vorschlag.

export const FAMILY_SWIM = {
  name: "Familienschwimmen",
  location: "Sportschule Hennef",
  waterTime: "12:00–12:45 Uhr",
  leaveBy: "13:00 Uhr",
  capacityMin: 8,
  capacityMax: 10,
  /** Absage später als so viele Stunden vor Beginn gibt einen Strafpunkt. */
  lateCancelHours: 48,
  /** Anmeldeschluss: so viele Tage vor dem Termin. */
  deadlineDaysBefore: 7,
} as const;

export type RequestStatus =
  "requested" | "confirmed" | "waitlist" | "declined" | "cancelled" | "attended" | "no_show";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Angefragt",
  confirmed: "Bestätigt",
  waitlist: "Warteliste",
  declined: "Abgelehnt",
  cancelled: "Storniert",
  attended: "Teilgenommen",
  no_show: "Nicht erschienen",
};

/** Status, die Plätze belegen. */
export const SEAT_STATUSES: RequestStatus[] = ["confirmed", "attended", "no_show"];

export type EventStatus = "open" | "inactive" | "cancelled";
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  open: "Offen",
  inactive: "Deaktiviert",
  cancelled: "Abgesagt",
};

/** Person aus dem Mitgliedskonto, die angemeldet werden kann. */
export type SwimPerson = {
  /** Stabiler Schlüssel: `${membershipId}:holder|partner|child-N` */
  key: string;
  name: string;
  role: "adult" | "child";
  date_of_birth: string | null;
  membership_id: string;
  /** Mitgliedschaftsart, über die die Person im Konto steht. */
  coverage: "single" | "family" | "youth";
};

export function ageOn(dob: string | null, onIso: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = onIso.slice(0, 10).split("-").map(Number) as [number, number, number];
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

type FamilyMembers =
  | {
      partner?: { name?: string | null; date_of_birth?: string | null } | null;
      children?: Array<{ name?: string | null; date_of_birth?: string | null }> | null;
    }
  | Array<{ name?: string | null; date_of_birth?: string | null; role?: string | null }>
  | null
  | undefined;

export type MembershipForSwim = {
  id: string;
  membership_type: "children_youth" | "adult" | "family" | "supporting";
  status: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  family_members: FamilyMembers;
};

/**
 * Personen, die ein Konto anmelden darf:
 *  - Einzelmitgliedschaft (Erwachsene): nur die Person selbst
 *  - Familienmitgliedschaft: Mitglied, Partner und alle eingetragenen Kinder
 *  - Kindermitgliedschaft: nur das Kind (später mit Bronze und Aufsichtsperson)
 *  - Fördermitgliedschaft: nicht berechtigt
 */
export function personsFromMemberships(
  memberships: MembershipForSwim[],
  todayIso: string,
): SwimPerson[] {
  const out: SwimPerson[] = [];
  for (const m of memberships) {
    if (m.status !== "active" || m.membership_type === "supporting") continue;
    const holderName = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Mitglied";
    const holderAge = ageOn(m.date_of_birth, todayIso);

    if (m.membership_type === "children_youth") {
      out.push({
        key: `${m.id}:holder`,
        name: holderName,
        role: holderAge != null && holderAge >= 18 ? "adult" : "child",
        date_of_birth: m.date_of_birth,
        membership_id: m.id,
        coverage: "youth",
      });
      continue;
    }

    out.push({
      key: `${m.id}:holder`,
      name: holderName,
      role: holderAge != null && holderAge < 18 ? "child" : "adult",
      date_of_birth: m.date_of_birth,
      membership_id: m.id,
      coverage: m.membership_type === "family" ? "family" : "single",
    });

    if (m.membership_type !== "family") continue;
    const fm = m.family_members;
    const partner = fm && !Array.isArray(fm) ? fm.partner : null;
    if (partner?.name?.trim()) {
      out.push({
        key: `${m.id}:partner`,
        name: partner.name.trim(),
        role: "adult",
        date_of_birth: partner.date_of_birth ?? null,
        membership_id: m.id,
        coverage: "family",
      });
    }
    const kids = fm && !Array.isArray(fm) ? (fm.children ?? []) : [];
    kids.forEach((c, i) => {
      if (!c?.name?.trim()) return;
      out.push({
        key: `${m.id}:child-${i}`,
        name: c.name.trim(),
        role: "child",
        date_of_birth: c.date_of_birth ?? null,
        membership_id: m.id,
        coverage: "family",
      });
    });
  }
  return out;
}

/**
 * Braucht die Auswahl eine Aufsichtsperson auf der Tribüne (und Bronze)?
 * Ja, wenn ein Kind ohne erwachsene Begleitung im Wasser kommt:
 *  - Kind mit reiner Kindermitgliedschaft: immer
 *  - Kind aus einer Familienmitgliedschaft: wenn kein Erwachsener derselben Familie mit ins Wasser geht
 */
export function needsGrandstandSupervision(selected: SwimPerson[]): boolean {
  return selected.some(
    (c) =>
      c.role === "child" &&
      (c.coverage === "youth" ||
        !selected.some(
          (a) =>
            a.role === "adult" && a.membership_id === c.membership_id && a.coverage === "family",
        )),
  );
}

export type SelectionInput = {
  selected: SwimPerson[];
  bronzeConfirmed: boolean;
  grandstandName: string;
};

/** Prüft die Auswahl. Gibt eine verständliche Fehlermeldung zurück oder null. */
export function validateSelection(input: SelectionInput): string | null {
  const { selected } = input;
  if (selected.length === 0) return "Bitte mindestens eine Person auswählen.";
  if (selected.length > 10) return "Es können höchstens 10 Personen angemeldet werden.";
  if (needsGrandstandSupervision(selected)) {
    if (!input.bronzeConfirmed) {
      return "Kinder ohne erwachsene Begleitung im Wasser müssen mindestens das Bronzeabzeichen haben (Schwimmausweis zum Termin mitbringen). Bitte bestätigen.";
    }
    if (input.grandstandName.trim().length < 3) {
      return "Bitte den Namen der volljährigen Aufsichtsperson auf der Tribüne angeben.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Priorität und Vergabe
// ---------------------------------------------------------------------------

export type Standing = {
  participations: number;
  strikes: number;
  /** Bereits zugesagte, noch nicht besuchte Termine der Terminserie. */
  pendingConfirmed: number;
  last_participation: string | null;
};

export const EMPTY_STANDING: Standing = {
  participations: 0,
  strikes: 0,
  pendingConfirmed: 0,
  last_participation: null,
};

/** Prioritätszahl: kleiner = früher dran. Strafpunkte zählen wie Teilnahmen. */
export function priorityScore(s: Standing): number {
  return s.participations + s.strikes;
}

export type AllocRequest = {
  id: string;
  userId: string;
  eventId: string;
  seats: number;
  requestedAt: string;
};

export type AllocEvent = {
  id: string;
  date: string;
  capacity: number;
  /** Bereits belegte Plätze (z. B. frühere Zusagen). */
  usedSeats: number;
};

/**
 * Reihenfolge (kleiner = zuerst):
 *  1. Teilnahmen plus Strafpunkte
 *  2. weniger bereits zugesagte Termine (verhindert „alle Termine“)
 *  3. längere Zeit seit der letzten tatsächlichen Teilnahme (nie teilgenommen = zuerst)
 *  4. frühere Anmeldung
 *  5. Konto-ID (nur damit das Ergebnis immer reproduzierbar ist)
 */
export function comparePriority(
  a: { userId: string; requestedAt: string; standing: Standing },
  b: { userId: string; requestedAt: string; standing: Standing },
): number {
  const d1 = priorityScore(a.standing) - priorityScore(b.standing);
  if (d1) return d1;
  const d2 = a.standing.pendingConfirmed - b.standing.pendingConfirmed;
  if (d2) return d2;
  const la = a.standing.last_participation ?? "";
  const lb = b.standing.last_participation ?? "";
  if (la !== lb) return la < lb ? -1 : 1;
  if (a.requestedAt !== b.requestedAt) return a.requestedAt < b.requestedAt ? -1 : 1;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

export type AllocResult = {
  /** Anfrage-IDs mit Zusage, in der Reihenfolge der Vergabe. */
  confirmed: Array<{ requestId: string; round: number }>;
  /** Anfrage-IDs ohne Platz, nach Priorität sortiert (je Termin). */
  waitlist: string[];
};

/**
 * Mehrstufige Vergabe: In jeder Runde erhält jede Familie höchstens einen weiteren Termin,
 * Familien mit geringerer Prioritätszahl zuerst. Eine Familie wird nie teilweise angenommen.
 */
export function proposeAllocation(input: {
  events: AllocEvent[];
  requests: AllocRequest[];
  standing: Record<string, Standing>;
}): AllocResult {
  const eventById = new Map(input.events.map((e) => [e.id, e]));
  const remaining = new Map(input.events.map((e) => [e.id, e.capacity - e.usedSeats]));
  const standingOf = (userId: string): Standing => ({
    ...EMPTY_STANDING,
    ...(input.standing[userId] ?? {}),
  });
  const gained = new Map<string, number>();

  const open = input.requests.filter((r) => eventById.has(r.eventId));
  const done = new Set<string>();
  const confirmed: AllocResult["confirmed"] = [];

  const view = (r: AllocRequest) => {
    const s = standingOf(r.userId);
    return {
      userId: r.userId,
      requestedAt: r.requestedAt,
      standing: { ...s, pendingConfirmed: s.pendingConfirmed + (gained.get(r.userId) ?? 0) },
    };
  };

  for (let round = 1; round <= 50; round++) {
    const byUser = new Map<string, AllocRequest[]>();
    for (const r of open) {
      if (done.has(r.id)) continue;
      const list = byUser.get(r.userId) ?? [];
      list.push(r);
      byUser.set(r.userId, list);
    }
    if (byUser.size === 0) break;

    const order = [...byUser.entries()]
      .map(([userId, list]) => ({
        userId,
        list: list.sort(
          (a, b) =>
            eventById.get(a.eventId)!.date.localeCompare(eventById.get(b.eventId)!.date) ||
            a.id.localeCompare(b.id),
        ),
      }))
      .sort((a, b) => comparePriority(view(a.list[0]!), view(b.list[0]!)));

    let assignedAny = false;
    for (const { userId, list } of order) {
      const pick = list.find((r) => r.seats <= (remaining.get(r.eventId) ?? 0));
      if (!pick) continue;
      remaining.set(pick.eventId, (remaining.get(pick.eventId) ?? 0) - pick.seats);
      done.add(pick.id);
      gained.set(userId, (gained.get(userId) ?? 0) + 1);
      confirmed.push({ requestId: pick.id, round });
      assignedAny = true;
    }
    if (!assignedAny) break;
  }

  const confirmedIds = new Set(confirmed.map((c) => c.requestId));
  const waitlist = open
    .filter((r) => !confirmedIds.has(r.id))
    .sort(
      (a, b) =>
        eventById.get(a.eventId)!.date.localeCompare(eventById.get(b.eventId)!.date) ||
        comparePriority(view(a), view(b)),
    )
    .map((r) => r.id);

  return { confirmed, waitlist };
}

/** Wer rückt nach? Höchste Priorität, deren gesamte Personenzahl noch in die freien Plätze passt. */
export function pickNextFromWaitlist(
  free: number,
  waiting: AllocRequest[],
  standing: Record<string, Standing>,
): AllocRequest | null {
  const sorted = [...waiting].sort((a, b) =>
    comparePriority(
      {
        userId: a.userId,
        requestedAt: a.requestedAt,
        standing: { ...EMPTY_STANDING, ...(standing[a.userId] ?? {}) },
      },
      {
        userId: b.userId,
        requestedAt: b.requestedAt,
        standing: { ...EMPTY_STANDING, ...(standing[b.userId] ?? {}) },
      },
    ),
  );
  return sorted.find((r) => r.seats <= free) ?? null;
}

// ---------------------------------------------------------------------------
// Zeiten
// ---------------------------------------------------------------------------

/** Beginn des Termins als UTC-Zeitpunkt (Berliner Ortszeit). */
export function eventStart(dateIso: string, startTime = "12:00"): Date {
  const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [hh, mm] = startTime.split(":").map(Number) as [number, number];
  // Berliner Offset für diesen Tag bestimmen (Sommer-/Winterzeit)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const berlin = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (berlin.getTime() - utc.getTime()));
}

/** Späte Absage: weniger als 48 Stunden vor Beginn. */
export function isLateCancel(dateIso: string, startTime: string, now = new Date()): boolean {
  const limit = eventStart(dateIso, startTime).getTime() - FAMILY_SWIM.lateCancelHours * 3600_000;
  return now.getTime() > limit;
}

export function weekdayDate(dateIso: string): string {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("de-DE", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
