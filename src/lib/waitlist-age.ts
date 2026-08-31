// Reine Hilfsfunktionen zum Mindestalter (client- und serverseitig nutzbar).

/**
 * Prüft, ob das Kind zum Kursbeginn das Mindestalter des Angebots erreicht.
 * Ohne Geburtsdatum, Startdatum oder Mindestalter wird nicht blockiert.
 */
export function meetsMinAge(
  childDob: string | null,
  startsOn: string | null,
  minAgeYears: number | null,
): boolean {
  if (!childDob || !startsOn || minAgeYears == null) return true;
  const dob = new Date(`${childDob}T00:00:00Z`);
  const start = new Date(`${startsOn}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(start.getTime())) return true;
  const ageYears = (start.getTime() - dob.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  return ageYears >= Number(minAgeYears) - 1e-9;
}

/** Datum, ab dem ein Kind das Mindestalter erreicht (ISO, YYYY-MM-DD). */
export function minAgeReachedOn(childDob: string | null, minAgeYears: number | null): string | null {
  if (!childDob || minAgeYears == null) return null;
  const dob = new Date(`${childDob}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const d = new Date(dob.getTime() + Number(minAgeYears) * 365.2425 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
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
