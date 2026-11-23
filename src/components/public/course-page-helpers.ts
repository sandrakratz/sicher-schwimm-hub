import { formatDateBerlin } from "@/lib/format";

/** Immer sichtbar: der Mitgliedsrabatt hängt an der im System bestätigten Mitgliedschaft (siehe member-claim.ts). */
export const MEMBER_DISCOUNT_NOTE =
  "Der Mitgliedsrabatt wird erst dann automatisch abgezogen, wenn die Mitgliedschaft durch den Vorstand bestätigt wurde.";

/** „1 freier Platz“ / „3 freie Plätze“ */
export function freeSlotsText(n: number): string {
  return `${n} ${n === 1 ? "freier Platz" : "freie Plätze"}`;
}

/** Text für das Verfügbarkeits-Banner („3 freie Plätze verfügbar!“). */
export function availableText(freeTotal: number): string {
  return freeTotal > 0 ? `${freeSlotsText(freeTotal)} verfügbar!` : "Freie Plätze verfügbar!";
}

/** „01.03.2026 – 31.05.2026“; ohne Startdatum „Termin folgt“. */
export function formatTermRange(startsOn: string | null, endsOn: string | null): string {
  return `${startsOn ? formatDateBerlin(startsOn) : "Termin folgt"}${endsOn ? ` – ${formatDateBerlin(endsOn)}` : ""}`;
}

/** Absätze einer Kursbeschreibung (durch Leerzeilen getrennt). */
export function splitParagraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n/).filter(Boolean);
}
