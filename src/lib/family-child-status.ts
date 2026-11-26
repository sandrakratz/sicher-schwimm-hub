// Reine Logik der Kind-Karten in der Familienakte: ein Satz zum aktuellen Stand je Kind und die
// Anliegen, die Eltern melden können. Ohne React und ohne Server, damit sie testbar bleibt.
import { formatDateBerlin } from "@/lib/format";

export type ChildEntry = {
  id: string;
  status: string;
  program: string | null;
  offerCourse: string | null;
  offerExpiresAt: string | null;
  availableFrom: string | null;
  adminNotes: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export type ChildBooking = {
  id: string;
  status: string;
  course: string;
  startsOn: string | null;
  paid: boolean;
  removedAt: string | null;
  cancelledAt: string | null;
  transferredAt: string | null;
  cancelReason: string | null;
  createdAt: string;
};

export type StatusTone = "good" | "info" | "warn" | "neutral";

/** Was Eltern melden können (Dialog „Eltern melden sich …“). */
export type Concern = "leave" | "decline_stay" | "other_course" | "sick";

export const CONCERN_LABEL: Record<Concern, string> = {
  leave: "Möchte nicht mehr bei uns schwimmen",
  decline_stay: "Sagt den angebotenen Platz ab, will weiter warten",
  other_course: "Möchte in einen anderen Kurs",
  sick: "Kind ist krank / fällt einmal aus",
};

/** Welcher Eintrag bzw. welche Buchung von einer Elternmeldung betroffen sein kann. */
export type ConcernTarget = {
  kind: "unregister" | "decline_leave" | "cancel_booking" | "decline_stay" | "transfer";
  id: string;
  label: string;
};

export const normChildName = (v: string | null | undefined) =>
  (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const NOTE_TS = /^\[(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+\d{1,2}:\d{2}(?::\d{2})?)?\]\s*(.*)$/;

/** Letzte Notizzeile der Verwaltung: Datum (YYYY-MM-DD) und Text ohne Zeitstempel. */
export function lastNote(
  notes: string | null | undefined,
): { day: string | null; text: string } | null {
  const lines = (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const line = lines[lines.length - 1];
  if (!line) return null;
  const m = line.match(NOTE_TS);
  if (!m) return { day: null, text: line };
  const [, d, mo, y, text] = m;
  return { day: `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`, text: text ?? "" };
}

function shorten(text: string, max = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Grund aus einer Notiz wie „Abgemeldet – Grund: bleibt bei der bisherigen Schwimmschule“. */
function reasonFromNote(text: string): string {
  return shorten(text.replace(/^(Abgemeldet|Absage)[^:]*:\s*/i, ""));
}

const withReason = (base: string, reason: string | null | undefined) =>
  reason && reason.trim() ? `${base}: ${shorten(reason)}` : base;

export type ChildStatus = {
  sentence: string;
  tone: StatusTone;
  /** Wird derzeit ein Platz gehalten oder darauf gewartet? */
  active: boolean;
};

/** Ein Satz zum aktuellen Stand des Kindes über alle Anfragelisten-Einträge und Buchungen. */
export function childStatus(
  entries: ChildEntry[],
  bookings: ChildBooking[],
  today: string,
): ChildStatus {
  const parts: { text: string; tone: StatusTone }[] = [];
  const hasConfirmed = bookings.some((b) => b.status === "confirmed");

  for (const b of bookings) {
    if (b.status === "confirmed") {
      const when = b.startsOn
        ? ` ${b.startsOn.slice(0, 10) > today ? "ab" : "seit"} ${formatDateBerlin(b.startsOn)}`
        : "";
      parts.push({
        text: `Gebucht: ${b.course}${when}, ${b.paid ? "bezahlt" : "Zahlung offen"}`,
        tone: b.paid ? "good" : "warn",
      });
    } else if (b.status === "waiting" && !b.removedAt) {
      parts.push({ text: `Auf der Warteliste für ${b.course}`, tone: "info" });
    }
  }
  for (const e of entries) {
    const prog = e.program ? ` ${e.program}` : "";
    if (e.status === "offered") {
      const until = e.offerExpiresAt ? ` bis ${formatDateBerlin(e.offerExpiresAt)}` : "";
      parts.push({ text: `Warteliste${prog} – Platz angeboten${until}`, tone: "warn" });
    } else if (e.status === "waiting") {
      const later =
        e.availableFrom && e.availableFrom.slice(0, 10) > today
          ? `wartet, frühestens ab ${formatDateBerlin(e.availableFrom)}`
          : "wartet auf einen Platz";
      parts.push({ text: `Warteliste${prog} – ${later}`, tone: "info" });
    } else if (e.status === "accepted" && !hasConfirmed) {
      parts.push({
        text: `Platz zugesagt${e.offerCourse ? `: ${e.offerCourse}` : ""}`,
        tone: "info",
      });
    }
  }
  if (parts.length > 0) {
    const tone: StatusTone = parts.some((p) => p.tone === "warn")
      ? "warn"
      : parts.some((p) => p.tone === "good")
        ? "good"
        : "info";
    return { sentence: parts.map((p) => p.text).join("; "), tone, active: true };
  }

  // Nichts Laufendes: jüngstes Ereignis nennen
  const past: { at: string; text: string }[] = [];
  for (const e of entries) {
    const note = lastNote(e.adminNotes);
    const at = note?.day ?? e.respondedAt ?? e.offerExpiresAt ?? e.createdAt;
    const day = formatDateBerlin(at);
    const reason = note?.text ? reasonFromNote(note.text) : "";
    if (e.status === "removed") past.push({ at, text: withReason(`Abgemeldet am ${day}`, reason) });
    else if (e.status === "declined")
      past.push({ at, text: withReason(`Platz abgesagt am ${day}`, reason) });
    else if (e.status === "expired") past.push({ at, text: `Angebotsfrist abgelaufen am ${day}` });
  }
  for (const b of bookings) {
    if (b.status !== "cancelled") continue;
    if (b.removedAt)
      past.push({
        at: b.removedAt,
        text: withReason(
          `Aus dem Kurs genommen am ${formatDateBerlin(b.removedAt)}`,
          b.cancelReason,
        ),
      });
    else if (b.transferredAt)
      past.push({
        at: b.transferredAt,
        text: withReason(`Umgebucht am ${formatDateBerlin(b.transferredAt)}`, b.cancelReason),
      });
    else
      past.push({
        at: b.cancelledAt ?? b.createdAt,
        text: withReason(
          `Abgesagt am ${formatDateBerlin(b.cancelledAt ?? b.createdAt)}`,
          b.cancelReason,
        ),
      });
  }
  past.sort((a, b) => b.at.localeCompare(a.at));
  if (past[0]) return { sentence: past[0].text, tone: "neutral", active: false };
  return { sentence: "Noch keine Anfrage und keine Buchung.", tone: "neutral", active: false };
}

/** Ziele einer Elternmeldung: welcher Eintrag bzw. welche Buchung betroffen sein kann. */
export function concernTargets(
  entries: ChildEntry[],
  bookings: ChildBooking[],
  concern: Concern,
): ConcernTarget[] {
  const out: ConcernTarget[] = [];
  const entryLabel = (e: ChildEntry) => `Warteliste${e.program ? ` ${e.program}` : ""}`;
  if (concern === "leave") {
    for (const e of entries) {
      if (["waiting", "declined", "expired"].includes(e.status))
        out.push({ kind: "unregister", id: e.id, label: entryLabel(e) });
      else if (e.status === "offered")
        out.push({ kind: "decline_leave", id: e.id, label: `${entryLabel(e)} (Platz angeboten)` });
    }
    for (const b of bookings)
      if (b.status === "confirmed")
        out.push({ kind: "cancel_booking", id: b.id, label: `Buchung ${b.course}` });
  } else if (concern === "decline_stay") {
    for (const e of entries)
      if (e.status === "offered")
        out.push({ kind: "decline_stay", id: e.id, label: `${entryLabel(e)} (Platz angeboten)` });
  } else if (concern === "other_course") {
    for (const b of bookings)
      if (b.status === "confirmed")
        out.push({ kind: "transfer", id: b.id, label: `Buchung ${b.course}` });
  }
  return out;
}

/** Die ein bis zwei wahrscheinlichsten Anliegen für die Knöpfe der Karte. */
export function suggestedConcerns(entries: ChildEntry[], bookings: ChildBooking[]): Concern[] {
  const out: Concern[] = [];
  if (entries.some((e) => e.status === "offered")) out.push("decline_stay");
  else if (bookings.some((b) => b.status === "confirmed")) out.push("other_course");
  if (concernTargets(entries, bookings, "leave").length > 0) out.push("leave");
  return out.slice(0, 2);
}

/** Alter in vollen Jahren am Stichtag; ohne Geburtsdatum null. */
export function ageYears(dob: string | null | undefined, today: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age >= 0 ? age : null;
}
