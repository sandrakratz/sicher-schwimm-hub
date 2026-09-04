// Deutsche Klartext-Bezeichnungen der E-Mail-Vorlagen (client-sicher, ohne
// React-Email-Abhängigkeiten – daher bewusst getrennt von der Registry).
export const TEMPLATE_LABELS: Record<string, string> = {
  'membership-application': 'Mitgliedsantrag (Benachrichtigung an den Verein)',
  'course-request': 'Kursanfrage (Benachrichtigung an den Verein)',
  'course-assignment': 'Kurszuteilung (Benachrichtigung an Eltern)',
  'contact-message': 'Kontaktnachricht (Benachrichtigung an den Verein)',
  'new-registration': 'Neue Registrierung (Benachrichtigung an den Verein)',
  'cancellation-internal': 'Widerruf (Benachrichtigung an den Verein)',
  'cancellation-confirmation': 'Widerruf – Eingangsbestätigung an Eltern',
  'course-booking-confirmation': 'Kursbuchung – Bestätigung & Zahlungsaufforderung',
  'course-waitlist-confirmation': 'Kursbuchung – Wartelisten-Bestätigung',
  'payment-check-reminder': 'Zahlungsprüfung 14 Tage nach Buchung (Verein)',
  'course-removal-unpaid': 'Kursplatz freigegeben (keine Rückmeldung/Zahlung)',
  'course-removal-agreed': 'Kursabmeldung wie besprochen',
  'course-request-reply': 'Antwort auf eine Kursanfrage',
  'message-reply': 'Antwort auf eine Nachricht',
  signup: 'Registrierung – E-Mail-Bestätigung',
  recovery: 'Passwort zurücksetzen',
  magiclink: 'Anmeldelink (Magic Link)',
  invite: 'Einladung',
  email_change: 'E-Mail-Adresse ändern',
  reauthentication: 'Erneute Bestätigung',
  test: 'Testversand',
}

export function templateLabel(name?: string | null): string {
  if (!name) return '—'
  return TEMPLATE_LABELS[name] ?? name
}
