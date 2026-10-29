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

/** Preis: Mitgliedspreis nur bei bestätigtem Mitglied. */
export function priceFor(
  isMember: boolean | null,
  prices: { member: number | null; nonMember: number | null },
): number | null {
  return isMember === true ? prices.member : prices.nonMember;
}
