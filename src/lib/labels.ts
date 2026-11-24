// Einheitliche, für Besucher verständliche Bezeichnungen.
// Damit heißt derselbe Weg überall gleich.

export const LABELS = {
  /** Button-/Link-Text, der zum Wartelisten-Formular unter /warteliste führt. */
  waitlistCta: "Auf die Warteliste",
  /** Überschrift und Seitentitel des Warteliste-Formulars. */
  waitlistPageTitle: "Kursanfrage & Warteliste",
  /** Bezeichnung der Person, die das Kind anmeldet. */
  guardian: "Erziehungsberechtigte:r",
  guardianFirstName: "Vorname (Erziehungsberechtigte:r)",
  guardianLastName: "Nachname (Erziehungsberechtigte:r)",
} as const;

/** Hinweis zu KI-generierten Abbildungen (zentral gepflegt). */
export const AI_IMAGE_NOTICE = "Abbildungen auf dieser Website sind teilweise KI-generiert";

/** Mitgliedschaftsarten, wie sie in der Verwaltung und im Trainerbereich heißen. */
export const MEMBERSHIP_TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};
