export type OfferDeadlineSettings = { far_weeks: number; days_far: number; days_near: number };

export const DEFAULT_OFFER_DEADLINES: OfferDeadlineSettings = {
  far_weeks: 4,
  days_far: 5,
  days_near: 3,
};

/** Berlin-Datum (YYYY-MM-DD) plus Tage, als reines Kalenderdatum. */
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Frist in Tagen für ein Platzangebot: eigene Frist des Kurszeitraums, sonst nach Abstand zum Kursbeginn.
 * Ohne Startdatum gilt die kürzere Frist.
 */
export function offerDays(
  course: { starts_on: string | null; offer_days_override?: number | null },
  settings: OfferDeadlineSettings,
  todayIso: string,
): number {
  if (course.offer_days_override && course.offer_days_override > 0)
    return course.offer_days_override;
  if (!course.starts_on) return settings.days_near;
  return course.starts_on >= addDaysIso(todayIso, settings.far_weeks * 7)
    ? settings.days_far
    : settings.days_near;
}
