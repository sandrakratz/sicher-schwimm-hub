// Reine Hilfsfunktionen zum Alter (client- und serverseitig nutzbar).
// Alle Prüfungen rechnen mit Kalenderdaten (Monate/Jahre), nicht mit Tageszählern –
// Buchung, Warteliste und Verwaltung kommen so zum selben Ergebnis.

function parseIso(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Datum, an dem jemand mit Geburtsdatum `dob` das Alter `years` (auch Bruchteile, z. B. 0,25) erreicht. */
function reachedOn(dob: { y: number; m: number; d: number }, years: number): string {
  const months = Math.round(Number(years) * 12);
  const total = dob.y * 12 + (dob.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(dob.d, lastDay);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Prüft, ob das Kind zum Kursbeginn das Mindestalter des Angebots erreicht.
 * Ohne Geburtsdatum, Startdatum oder Mindestalter wird nicht blockiert.
 */
export function meetsMinAge(
  childDob: string | null,
  startsOn: string | null,
  minAgeYears: number | null,
): boolean {
  const dob = parseIso(childDob);
  if (!dob || !startsOn || !parseIso(startsOn) || minAgeYears == null) return true;
  return reachedOn(dob, minAgeYears) <= startsOn.slice(0, 10);
}

/**
 * Prüft, ob das Kind zum Kursbeginn das Höchstalter noch nicht überschritten hat
 * (z. B. 5 = bis einschließlich 5 Jahre; am 6. Geburtstag nicht mehr).
 * Ohne Geburtsdatum, Startdatum oder Höchstalter wird nicht blockiert.
 */
export function withinMaxAge(
  childDob: string | null,
  startsOn: string | null,
  maxAgeYears: number | null,
): boolean {
  const dob = parseIso(childDob);
  if (!dob || !startsOn || !parseIso(startsOn) || maxAgeYears == null) return true;
  return startsOn.slice(0, 10) < reachedOn(dob, Number(maxAgeYears) + 1);
}

/** Datum, ab dem ein Kind das Mindestalter erreicht (ISO, YYYY-MM-DD). */
export function minAgeReachedOn(childDob: string | null, minAgeYears: number | null): string | null {
  const dob = parseIso(childDob);
  if (!dob || minAgeYears == null) return null;
  return reachedOn(dob, minAgeYears);
}

/** Ordnet einen Freitext-Kurswunsch dem am besten passenden Angebot zu. */
export function matchProgram<T extends { id: string; name: string; slug?: string | null }>(
  wish: string | null | undefined,
  programs: Array<T>,
): T | null {
  const text = (wish ?? "").toLowerCase().trim();
  if (!text) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
  const hay = norm(text);
  let best: { p: T; score: number } | null = null;
  for (const p of programs) {
    const candidates = [p.name, p.slug ?? ""].filter(Boolean).map(norm);
    let score = 0;
    for (const c of candidates) {
      if (!c) continue;
      if (hay === c) score = Math.max(score, 100);
      else if (hay.includes(c) || c.includes(hay)) score = Math.max(score, 60);
      else {
        const words = c.split(" ").filter((w) => w.length > 3);
        const hits = words.filter((w) => hay.includes(w)).length;
        if (hits > 0) score = Math.max(score, 20 + hits * 10);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best ? best.p : null;
}
