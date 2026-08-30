# Neue Zahlungsbedingungen umsetzen

## Neue Regel

- Kursgebühr fällig innerhalb von 14 Tagen nach der Buchungsbestätigung, spätestens jedoch **bis 10 Tage vor Kursbeginn**.
- Wird ein Kurs **innerhalb der letzten 10 Tage vor Kursbeginn** gebucht, ist die Gebühr **sofort per Echtzeit-/Sofortüberweisung** zu zahlen.

## Was geändert wird

1. **Zentraler Hinweistext** (`src/lib/billing-config.ts`, Feld `dueNote`): neuer Wortlaut mit beiden Sätzen. Dieser Text erscheint automatisch auf der Kursübersicht `/kurse` und auf allen Kursdetailseiten.

2. **Fälligkeitsberechnung** (`src/lib/course-confirmation.ts`): Statt „ein Tag vor Kursbeginn" gilt künftig „10 Tage vor Kursbeginn" als spätester Termin. Liegt dieser Termin bereits in der Vergangenheit oder heute (Buchung kurz vor Kursstart), wird die Zahlung als sofort fällig gekennzeichnet.

3. **Kursbestätigungs-E-Mail** (`src/lib/email-templates/course-booking-confirmation.tsx`): Bei Sofortfälligkeit wird statt „Bitte überweisen Sie bis zum …" ein deutlicher Hinweis auf Echtzeit-/Sofortüberweisung ausgegeben; sonst bleibt das berechnete Fälligkeitsdatum wie bisher.

4. **PDF-Kursbestätigung** (`src/lib/course-confirmation-pdf.server.ts`): gleicher Zahlungshinweis wie in der E-Mail, damit Beleg und E-Mail identisch sind.

5. **Zuweisungs-E-Mail** (`src/lib/email-templates/course-assignment.tsx`): Der Satz „innerhalb von 14 Tagen nach Erhalt dieser E-Mail" wird um die 10-Tage-Grenze und die Sofortüberweisungs-Regel ergänzt.

6. **Kursteilnahmebedingungen** (`src/routes/kursbedingungen.tsx`, Abschnitt 2): Absatz auf die neue Regelung umformuliert (14 Tage / spätestens 10 Tage vor Kursbeginn / Sofortüberweisung bei kurzfristiger Buchung).

## Technische Hinweise

- `computeDueDate` erhält den Versatz `-10` Tage statt `-1`; zusätzlich liefert `buildConfirmationDoc` ein neues Feld (z. B. `immediatePayment: boolean`) plus fertigen Zahlungssatz, den E-Mail und PDF gemeinsam nutzen.
- Keine Datenbankänderung nötig; `payment_due_days` (Standard 14) bleibt unverändert konfigurierbar.
