// Reine Auswertungen für die Downloads der Verwaltung (ohne Datenbank, testbar).
// Die Server-Funktionen in reports.functions.ts laden die Daten und schreiben daraus Excel-Dateien.
import { EXAM_LEVELS, examLevelLabel } from "@/lib/swim-exams";

// ---------- Abzeichen-Statistik ----------

export type ExamRow = {
  exam_level: string | null;
  goal_reached: boolean | null;
  /** Prüfungsdatum; ersatzweise Kursende */
  date: string | null;
  source: "kurs" | "extern";
};

export type BadgeStat = {
  level: string;
  label: string;
  kurs: number;
  extern: number;
  gesamt: number;
  nichtBestanden: number;
};

/** Bestandene Abzeichen eines Jahres je Stufe (Kurs/extern) – nur Zahlen, keine Namen. */
export function badgeStats(rows: ExamRow[], year: number): BadgeStat[] {
  const prefix = `${year}-`;
  const byLevel = new Map<string, BadgeStat>();
  const get = (key: string) => {
    let s = byLevel.get(key);
    if (!s) {
      s = {
        level: key,
        label: examLevelLabel(key),
        kurs: 0,
        extern: 0,
        gesamt: 0,
        nichtBestanden: 0,
      };
      byLevel.set(key, s);
    }
    return s;
  };
  for (const r of rows) {
    if (!r.exam_level || !r.date?.startsWith(prefix)) continue;
    const s = get(r.exam_level);
    if (r.goal_reached === true) {
      s[r.source]++;
      s.gesamt++;
    } else if (r.goal_reached === false) s.nichtBestanden++;
  }
  // Reihenfolge wie in der Prüfungsordnung, unbekannte Stufen hinten
  const order = (k: string) => {
    const i = EXAM_LEVELS.findIndex((l) => l.key === k);
    return i < 0 ? 999 : i;
  };
  return [...byLevel.values()].sort((a, b) => order(a.level) - order(b.level));
}

// ---------- Mitglieder (inkl. Familienmitglieder) ----------

export type MembershipRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender?: string | null;
  email: string | null;
  member_email?: string | null;
  guardian_email?: string | null;
  membership_type: string;
  status: string;
  start_date?: string | null;
  valid_until?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  family_members?: unknown;
};

type FamilyPerson = {
  name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  email?: string | null;
};

export type MemberPerson = {
  membershipId: string;
  rolle: "Hauptmitglied" | "Partner:in" | "Kind";
  vorname: string;
  nachname: string;
  geburtsdatum: string | null;
  /** w/m/d, null = nicht erfasst */
  geschlecht: string | null;
  /** Wohin Post/Glückwünsche gehen: eigene E-Mail, sonst die des Hauptmitglieds bzw. der Eltern */
  email: string | null;
  membershipType: string;
  status: string;
  eintritt: string | null;
  austritt: string | null;
};

/** „Anna Maria Muster“ → Vorname „Anna Maria“, Nachname „Muster“. */
function splitName(full: string | null | undefined, fallbackLast: string): [string, string] {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", fallbackLast];
  if (parts.length === 1) return [parts[0]!, fallbackLast];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]!];
}

/** Alle Personen einer Mitgliedschaft: Hauptmitglied, Partner:in und Kinder aus dem Antrag. */
export function personsOf(m: MembershipRow): MemberPerson[] {
  const last = (m.last_name ?? "").trim();
  const mainEmail = m.member_email || m.email || m.guardian_email || null;
  const base = {
    membershipId: m.id,
    membershipType: m.membership_type,
    status: m.status,
    eintritt: m.start_date ?? m.approved_at?.slice(0, 10) ?? null,
    austritt: m.valid_until ?? null,
  };
  const out: MemberPerson[] = [
    {
      ...base,
      rolle: "Hauptmitglied",
      vorname: (m.first_name ?? "").trim(),
      nachname: last,
      geburtsdatum: m.date_of_birth,
      geschlecht: m.gender ?? null,
      email: mainEmail,
    },
  ];
  const fm = (m.family_members ?? null) as {
    partner?: FamilyPerson | null;
    children?: FamilyPerson[] | null;
  } | null;
  if (fm?.partner?.name) {
    const [v, n] = splitName(fm.partner.name, last);
    out.push({
      ...base,
      rolle: "Partner:in",
      vorname: v,
      nachname: n,
      geburtsdatum: fm.partner.date_of_birth ?? null,
      geschlecht: fm.partner.gender ?? null,
      email: fm.partner.email || mainEmail,
    });
  }
  for (const c of fm?.children ?? []) {
    if (!c?.name) continue;
    const [v, n] = splitName(c.name, last);
    out.push({
      ...base,
      rolle: "Kind",
      vorname: v,
      nachname: n,
      geburtsdatum: c.date_of_birth ?? null,
      geschlecht: c.gender ?? null,
      email: mainEmail,
    });
  }
  return out;
}

/** War die Mitgliedschaft am Stichtag aktiv? (genehmigt, begonnen, nicht beendet) */
export function activeOn(m: MembershipRow, day: string): boolean {
  if (m.status === "pending") return false;
  const start = m.start_date ?? m.approved_at?.slice(0, 10) ?? null;
  if (start && start > day) return false;
  if (m.valid_until && m.valid_until < day) return false;
  // Beendet/ruhend ohne Enddatum: nur zählen, wenn ein Enddatum nach dem Stichtag eingetragen ist
  if (m.status !== "active" && !m.valid_until) return false;
  return true;
}

/** Alter in vollen Jahren an einem Tag (null ohne Geburtsdatum). */
export function ageOn(dob: string | null, day: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = day.slice(0, 10).split("-").map(Number) as [number, number, number];
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// ---------- Bestandsmeldung (Landessportbund) ----------

/** Übliche Altersgruppen der Bestandserhebung: Obergrenzen „bis einschließlich“, danach „älter“. */
export const DEFAULT_AGE_BOUNDS = [6, 14, 18, 26, 40, 60];

export type CensusRow = {
  gruppe: string;
  w: number;
  m: number;
  d: number;
  ohne: number;
  gesamt: number;
};
export type Census = {
  rows: CensusRow[];
  total: CensusRow;
  ohneGeburtsdatum: MemberPerson[];
  ohneGeschlecht: MemberPerson[];
};

/** Altersgruppen-Bezeichnungen aus Obergrenzen, z. B. [6, 14] → „bis 6“, „7–14“, „15 und älter“. */
export function ageGroupLabels(bounds: number[]): string[] {
  const b = [...new Set(bounds)].filter((n) => Number.isInteger(n) && n >= 0).sort((x, y) => x - y);
  const out: string[] = [];
  let from = 0;
  for (const up of b) {
    out.push(from === 0 ? `bis ${up}` : from === up ? `${up}` : `${from}–${up}`);
    from = up + 1;
  }
  out.push(`${from} und älter`);
  return out;
}

/** Bezeichnung der Altersgruppe für ein Alter, passend zu `ageGroupLabels(bounds)`. */
export function ageGroupOf(age: number, bounds: number[]): string {
  const b = [...new Set(bounds)].filter((n) => Number.isInteger(n) && n >= 0).sort((x, y) => x - y);
  const i = b.findIndex((up) => age <= up);
  return ageGroupLabels(b)[i < 0 ? b.length : i]!;
}

/** Zählt Personen am Stichtag nach Altersgruppe × Geschlecht; fehlende Angaben werden gelistet. */
export function census(persons: MemberPerson[], day: string, bounds = DEFAULT_AGE_BOUNDS): Census {
  const labels = ageGroupLabels(bounds);
  const empty = (gruppe: string): CensusRow => ({ gruppe, w: 0, m: 0, d: 0, ohne: 0, gesamt: 0 });
  const rows = labels.map(empty);
  const total = empty("Gesamt");
  const ohneGeburtsdatum: MemberPerson[] = [];
  const ohneGeschlecht: MemberPerson[] = [];
  for (const p of persons) {
    const age = ageOn(p.geburtsdatum, day);
    if (age == null) {
      ohneGeburtsdatum.push(p);
      continue;
    }
    const i = labels.indexOf(ageGroupOf(age, bounds));
    const g =
      p.geschlecht === "w" || p.geschlecht === "m" || p.geschlecht === "d" ? p.geschlecht : "ohne";
    if (g === "ohne") ohneGeschlecht.push(p);
    for (const r of [rows[i]!, total]) {
      r[g]++;
      r.gesamt++;
    }
  }
  return { rows, total, ohneGeburtsdatum, ohneGeschlecht };
}

// ---------- Geburtstage ----------

export type Birthday = MemberPerson & { tag: string; wirdAlt: number; inTagen: number };

/** Geburtstage in den nächsten `days` Tagen (heute eingeschlossen), nach Datum sortiert. */
export function upcomingBirthdays(persons: MemberPerson[], today: string, days = 30): Birthday[] {
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const out: Birthday[] = [];
  for (const p of persons) {
    if (!p.geburtsdatum || !/^\d{4}-\d{2}-\d{2}/.test(p.geburtsdatum)) continue;
    const [by, bm, bd] = p.geburtsdatum.slice(0, 10).split("-").map(Number) as [
      number,
      number,
      number,
    ];
    for (const y of [+today.slice(0, 4), +today.slice(0, 4) + 1]) {
      // 29.02. in Nicht-Schaltjahren am 28.02. feiern
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const day = bm === 2 && bd === 29 && !leap ? 28 : bd;
      const at = Date.UTC(y, bm - 1, day);
      const diff = Math.round((at - t) / 86400000);
      if (diff >= 0 && diff <= days) {
        out.push({
          ...p,
          tag: `${y}-${String(bm).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          wirdAlt: y - by,
          inTagen: diff,
        });
        break;
      }
    }
  }
  return out.sort((a, b) => a.inTagen - b.inTagen || a.nachname.localeCompare(b.nachname));
}

// ---------- Auslastung und Nachfrage ----------

export type DemandCourse = {
  program_id: string | null;
  starts_on: string | null;
  max_participants: number | null;
  confirmed: number;
  cancelled: number;
};
export type DemandEntry = {
  program_id: string | null;
  created_at: string;
  status: string;
  decline_count: number;
};
export type DemandStat = {
  programId: string | null;
  kurse: number;
  plaetze: number;
  gebucht: number;
  auslastung: number | null;
  storniert: number;
  neueAnfragen: number;
  absagenAngebote: number;
  wartendJetzt: number;
};

/** Je Angebot: Kurse mit Start im Jahr, Plätze, Buchungen, Stornos und Nachfrage über die Anfrageliste. */
export function demandStats(
  courses: DemandCourse[],
  entries: DemandEntry[],
  year: number,
): DemandStat[] {
  const prefix = `${year}-`;
  const map = new Map<string, DemandStat>();
  const get = (pid: string | null) => {
    const k = pid ?? "";
    let s = map.get(k);
    if (!s) {
      s = {
        programId: pid,
        kurse: 0,
        plaetze: 0,
        gebucht: 0,
        auslastung: null,
        storniert: 0,
        neueAnfragen: 0,
        absagenAngebote: 0,
        wartendJetzt: 0,
      };
      map.set(k, s);
    }
    return s;
  };
  for (const c of courses) {
    if (!c.starts_on?.startsWith(prefix)) continue;
    const s = get(c.program_id);
    s.kurse++;
    s.plaetze += c.max_participants ?? 0;
    s.gebucht += c.confirmed;
    s.storniert += c.cancelled;
  }
  for (const e of entries) {
    const s = get(e.program_id);
    if (e.created_at.startsWith(prefix)) {
      s.neueAnfragen++;
      s.absagenAngebote += e.decline_count;
    }
    if (e.status === "waiting") s.wartendJetzt++;
  }
  for (const s of map.values())
    s.auslastung = s.plaetze > 0 ? Math.round((s.gebucht / s.plaetze) * 100) : null;
  return [...map.values()];
}
