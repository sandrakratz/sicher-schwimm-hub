// Mitgliedspreis nur mit bestätigter Mitgliedschaft.
//
// Eine Selbstangabe im Formular ("Wir sind Mitglied") begründet allein keinen Mitgliedspreis:
//  - System findet eine aktive Mitgliedschaft → Mitglied, Mitgliedspreis
//  - nur Selbstangabe                          → Normalpreis, Verwaltung muss prüfen (member_check = pending),
//                                                bis dahin keine Zahlungsmails
//  - keine Angabe                              → kein Mitglied (bzw. das, was das System weiß)

export type MemberDecision = {
  /** true = bestätigtes Mitglied, false = kein Mitglied, null = Angabe ungeprüft */
  isMember: boolean | null;
  /** 'pending' = Verwaltung muss die Mitgliedschaft prüfen, bevor Zahlungsmails rausgehen */
  check: "pending" | null;
};

export function decideMember(input: {
  claimed: boolean;
  /** Ergebnis der Systemprüfung: true = aktives Mitglied, false = nicht aktiv, null = unbekannt */
  verified: boolean | null;
}): MemberDecision {
  if (input.verified === true) return { isMember: true, check: null };
  if (input.claimed) return { isMember: null, check: "pending" };
  return { isMember: false, check: null };
}

/**
 * Gilt die Mitgliedschaft an diesem Tag (z. B. Kursstart)? Beides ISO-Datum (JJJJ-MM-TT).
 * `start_date` = Mitglied ab, `valid_until` = gültig bis (nach Kündigung zum Jahresende).
 * Leer bedeutet: keine Einschränkung (ältere Mitgliedschaften ohne Datum gelten durchgehend).
 */
export function membershipValidOn(
  m: { start_date?: string | null; valid_until?: string | null },
  day: string,
): boolean {
  if (m.start_date && day < m.start_date) return false;
  if (m.valid_until && day > m.valid_until) return false;
  return true;
}

/** Spätester wählbarer Beginn einer Mitgliedschaft: 6 Monate nach `today` (JJJJ-MM-TT). */
export function maxMembershipStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/** Preis: Mitgliedspreis nur bei bestätigtem Mitglied. */
export function priceFor(
  isMember: boolean | null,
  prices: { member: number | null; nonMember: number | null },
): number | null {
  return isMember === true ? prices.member : prices.nonMember;
}
