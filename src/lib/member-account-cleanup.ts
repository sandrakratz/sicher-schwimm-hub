/** Tage nach „gültig bis“, bis das Login eines gekündigten Mitglieds gelöscht wird. */
export const ACCOUNT_GRACE_DAYS = 30;

/** Stichtag (JJJJ-MM-TT): Mitgliedschaften mit „gültig bis“ an oder vor diesem Tag sind löschreif. */
export function accountCleanupCutoff(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ACCOUNT_GRACE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Konten, die gelöscht werden dürfen: Alle Mitgliedschaften des Kontos haben ein „gültig bis“ am oder
 * vor dem Stichtag. Ohne Datum (NULL) gilt eine Mitgliedschaft unbegrenzt und schützt das Konto.
 */
export function expiredMemberUserIds(
  rows: { user_id: string | null; valid_until: string | null }[],
  cutoff: string,
): string[] {
  const expired = new Map<string, boolean>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const over = !!r.valid_until && r.valid_until <= cutoff;
    expired.set(r.user_id, (expired.get(r.user_id) ?? true) && over);
  }
  return [...expired].filter(([, over]) => over).map(([id]) => id);
}
