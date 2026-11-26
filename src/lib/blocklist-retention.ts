// Löschkonzept 2027 (Vorstand 26.11.2026): Sperrlisten-Einträge werden 2 Jahre nach dem Eintrag
// automatisch gelöscht (run_retention_2027), außer der Vorstand verlängert sie (keep_until).
// Der Eingang erinnert 4 Wochen vorher.

export const BLOCKLIST_YEARS = 2;
export const BLOCKLIST_REMIND_DAYS = 28;

/** Tag, bis zu dem der Eintrag bleibt (am Folgetag löscht der Job), als YYYY-MM-DD. */
export function blocklistExpiry(createdAt: string, keepUntil: string | null | undefined): string {
  if (keepUntil) return keepUntil.slice(0, 10);
  const d = new Date(createdAt);
  return `${d.getUTCFullYear() + BLOCKLIST_YEARS}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Läuft in den nächsten 4 Wochen ab (heute eingeschlossen)? `today` als YYYY-MM-DD. */
export function blocklistExpiringSoon(expiry: string, today: string): boolean {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + BLOCKLIST_REMIND_DAYS);
  return expiry >= today && expiry <= limit.toISOString().slice(0, 10);
}

/** Neues „aufbewahren bis“ bei Verlängerung: heute + 2 Jahre. */
export function blocklistExtendedUntil(today: string): string {
  const [y, m, d] = today.split("-");
  return `${Number(y) + BLOCKLIST_YEARS}-${m}-${d}`;
}
