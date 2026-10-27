// Folgekurs-Kandidaten: aus den Buchungen je Kind ableiten, wer als Nächstes in welchen Kurs passt.
// Reine Rechenlogik ohne Datenbankzugriff (wird von der Verwaltungsseite und vom Excel-Export genutzt).

/** Skala wie `course_programs.min_swim_level`: 0 unbekannt, 2 Seepferdchen, 3 Bronze, 5 Silber, 6 Gold. */
export type SwimLevel = 0 | 2 | 3 | 5 | 6;

export const LEVEL_LABEL: Record<SwimLevel, string> = {
  0: "kein Abzeichen erfasst",
  2: "Seepferdchen",
  3: "Bronze",
  5: "Silber",
  6: "Gold",
};

export type BookingRow = {
  id: string;
  participant_name: string | null;
  date_of_birth: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  status: string;
  exam_level: string | null;
  goal_reached: boolean | null;
  badge: string | null;
  belt_blocks: number | null;
  course_name: string;
  starts_on: string | null;
  ends_on: string | null;
  parent_name: string | null;
  contact_permission: boolean | null;
  request_level: string | null;
};

export type WaitingRow = { child_name: string | null; child_dob: string | null };

export type Group = "wasserzeit" | "schwimmstarter" | "seepferdchen" | "bronze" | "aufbau";

export const GROUP_LABEL: Record<Group, string> = {
  wasserzeit: "Aus Wasserzeit – bereit für Schwimmstarter?",
  schwimmstarter: "Aus Schwimmstarter – bereit für Seepferdchen?",
  seepferdchen: "Seepferdchen noch offen",
  bronze: "Seepferdchen vorhanden – bereit für Bronze",
  aufbau: "Bronze/Silber/Gold vorhanden – Aufbaukurs",
};

export type Candidate = {
  key: string;
  name: string;
  dob: string | null;
  age: number | null;
  parent: string;
  email: string;
  phone: string;
  /** true = Kontakt per Anfrage erlaubt, false = ausdrücklich nicht, null = Direktbuchung (unbekannt) */
  contactOk: boolean | null;
  level: SwimLevel;
  /** Woher die Einstufung stammt: von der Trainer:in erfasst, Angabe der Eltern oder unbekannt */
  levelSource: "Prüfung erfasst" | "Angabe Eltern" | "nicht erfasst";
  lastCourse: string;
  lastStart: string;
  lastEnd: string;
  /** Kurs ist schon vorbei oder läuft noch (Ergebnis dann ggf. noch offen) */
  phase: "beendet" | "läuft";
  onWaitlist: boolean;
  courses: string[];
  group: Group;
  /** Klötzchen am Gurt im letzten Kurs mit erfasstem Stand (6 = Anfänger … 0 = ohne Gurt), null = nicht erfasst */
  belt: number | null;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Name zum Vergleichen: ohne Groß-/Kleinschreibung, Akzente und ß (ß = ss). */
function nameKey(name: string | null | undefined): string {
  return norm(name)
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

const EXAM_RANK: Record<string, SwimLevel> = {
  seepferdchen: 2,
  seeraeuber: 2,
  bronze: 3,
  silber: 5,
  gold: 6,
};

/** Liest ein Abzeichen aus Freitext („Seepferdchen vorgeschritten“, „Silber“ …). */
export function levelFromText(text: string | null | undefined): SwimLevel {
  const t = norm(text);
  if (!t) return 0;
  if (/\bgold\b/.test(t)) return 6;
  if (/\bsilber\b/.test(t)) return 5;
  if (/\bbronze\b|freischwimmer/.test(t)) return 3;
  // „ohne Abzeichen“ / „kein Seepferdchen“ nicht als Seepferdchen werten
  if (
    /seepferd|fr(ü|ue)hschwimmer/.test(t) &&
    !/\b(ohne|kein|keins|noch nicht|vorbereitung)\b/.test(t)
  )
    return 2;
  return 0;
}

export function ageOn(dob: string | null, today: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/**
 * Gruppiert Buchungen je Kind (Name + Geburtsdatum) und liefert nur Kinder,
 * - die bei uns einen Kurs hatten oder gerade haben (nicht storniert),
 * - und noch keinen später beginnenden Kurs gebucht haben.
 * Gebucht = Zeile mit Status „confirmed“; Warteliste wird nur als Hinweis gezeigt.
 */
export function buildCandidates(
  rows: BookingRow[],
  waiting: WaitingRow[],
  today: string,
): Candidate[] {
  // Dasselbe Kind kann mit leicht anderer Schreibweise gebucht sein (Koßmann/Kossmann, Goschnik/Goschnick):
  // gleiches Geburtsdatum und fast gleicher Name gelten als dasselbe Kind.
  const known: { key: string; name: string; dob: string | null }[] = [];
  const kidKey = (name: string | null, dob: string | null) => {
    const n = nameKey(name);
    const hit = known.find(
      (k) => k.dob === dob && (dob ? editDistance(k.name, n) <= 2 : k.name === n),
    );
    if (hit) return hit.key;
    const key = `${n}|${dob ?? ""}`;
    known.push({ key, name: n, dob });
    return key;
  };

  const byKid = new Map<string, BookingRow[]>();
  for (const r of rows) {
    if (r.status === "cancelled" || !r.participant_name) continue;
    const k = kidKey(r.participant_name, r.date_of_birth);
    byKid.set(k, [...(byKid.get(k) ?? []), r]);
  }

  const waitKeys = new Set(waiting.map((w) => kidKey(w.child_name, w.child_dob)));

  const out: Candidate[] = [];
  for (const [key, list] of byKid) {
    list.sort((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""));
    if (list.some((r) => (r.starts_on ?? "") > today)) continue; // Folgekurs schon gebucht
    const started = list.filter((r) => (r.starts_on ?? "") <= today);
    if (!started.length) continue;
    const last = started[started.length - 1]!;

    // Einstufung: beste erfasste Prüfung, sonst Angabe der Eltern aus der Anfrage
    let level: SwimLevel = 0;
    let levelSource: Candidate["levelSource"] = "nicht erfasst";
    for (const r of list) {
      const fromExam = r.exam_level ? (EXAM_RANK[r.exam_level] ?? 0) : 0;
      const fromBadge = r.goal_reached === false ? 0 : levelFromText(r.badge);
      const v = Math.max(fromExam, fromBadge) as SwimLevel;
      if (v > level) {
        level = v;
        levelSource = "Prüfung erfasst";
      }
    }
    if (levelSource === "nicht erfasst") {
      for (const r of list) {
        const v = levelFromText(r.request_level);
        if (v > level) {
          level = v;
          levelSource = "Angabe Eltern";
        }
      }
    }

    // Wasserzeit/Schwimmstarter haben keine Prüfung; dort zählt der Gurt-Stand.
    const stage: Group | null =
      level >= 2
        ? null
        : /wasserzeit/i.test(last.course_name)
          ? "wasserzeit"
          : /schwimmstarter/i.test(last.course_name)
            ? "schwimmstarter"
            : null;
    const group: Group = stage ?? (level >= 3 ? "aufbau" : level === 2 ? "bronze" : "seepferdchen");
    const belt = [...started].reverse().find((r) => r.belt_blocks != null)?.belt_blocks ?? null;
    const contact = list.find((r) => r.participant_email) ?? list[0]!;
    const permissions = list.map((r) => r.contact_permission).filter((p) => p != null);

    out.push({
      key,
      name: last.participant_name!,
      dob: last.date_of_birth,
      age: ageOn(last.date_of_birth, today),
      parent: list.find((r) => r.parent_name)?.parent_name ?? "",
      email: contact.participant_email ?? "",
      phone: contact.participant_phone ?? "",
      contactOk: permissions.length ? permissions.some((p) => p === true) : null,
      level,
      levelSource,
      lastCourse: last.course_name,
      lastStart: last.starts_on ?? "",
      lastEnd: last.ends_on ?? "",
      phase: (last.ends_on ?? "") < today ? "beendet" : "läuft",
      onWaitlist: waitKeys.has(key),
      courses: list.map((r) => r.course_name),
      group,
      belt,
    });
  }
  return out.sort(
    (a, b) => a.lastEnd.localeCompare(b.lastEnd) || a.name.localeCompare(b.name, "de"),
  );
}
