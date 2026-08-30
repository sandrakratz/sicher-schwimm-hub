// Einheitliche Status-Darstellung für Kursangebote und Kurstermine.
// Alle Farben stammen aus dem Designsystem (success / warning / destructive).

export type CourseStatusTone = "open" | "full" | "waitlist";

const TONE_CLASS: Record<CourseStatusTone, string> = {
  open: "bg-success/15 text-success border-success/30",
  full: "bg-destructive/10 text-destructive border-destructive/30",
  waitlist: "bg-warning/15 text-warning-foreground border-warning/30",
};

export function courseStatusClass(tone: CourseStatusTone): string {
  return TONE_CLASS[tone];
}

/** Status eines Kursangebots (Programm) anhand der buchbaren Termine. */
export function programStatus(openTerms: number, hasTerms: boolean): {
  tone: CourseStatusTone;
  label: string;
  className: string;
} {
  const tone: CourseStatusTone = openTerms > 0 ? "open" : hasTerms ? "full" : "waitlist";
  const label =
    openTerms > 0
      ? `${openTerms} Termin${openTerms > 1 ? "e" : ""} buchbar`
      : hasTerms
        ? "Ausgebucht"
        : "Warteliste";
  return { tone, label, className: TONE_CLASS[tone] };
}

/** Status eines einzelnen Kurstermins. */
export function termStatus(isFull: boolean, freeSlots: number | null | undefined): {
  tone: CourseStatusTone;
  label: string;
  className: string;
} {
  const tone: CourseStatusTone = isFull ? "full" : "open";
  const label = isFull
    ? "Ausgebucht"
    : freeSlots != null
      ? `${freeSlots} freie Plätze`
      : "Plätze frei";
  return { tone, label, className: TONE_CLASS[tone] };
}
