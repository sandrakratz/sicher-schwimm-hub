# Zahlungserinnerungen: freundlich 3 Tage vorher, Warnung 1 Tag vorher

## Was heute im System automatisch läuft

Täglich um 8 Uhr (Berlin):
- **Geldeingang prüfen (an euch, info@sicher-schwimmen.com)** – seit der letzten Änderung für Buchungen, deren Zahlungsfrist innerhalb der nächsten 3 Tage abläuft. Geht einmal pro Buchung raus. An die Eltern geht dabei nichts.
- **Kursstart-Erinnerung an die Eltern** – 3 Tage vor dem ersten Kurstag.

Stündlich:
- **Warteliste** – abgelaufene Platzangebote schließen, frei gewordene Plätze anbieten.

Nur manuell (Knopf in der Kursverwaltung):
- **Zahlungserinnerung an Eltern** – für Buchungen mit Sofortzahlung oder bereits überschrittener Frist.

Automatische Erinnerungen an Eltern vor Ablauf der Zahlungsfrist gibt es also bisher **nicht**.

## Was neu kommt

Zwei automatische E-Mails an die Eltern, beide einmalig pro Buchung, nur bei bestätigten, unbezahlten Online-Buchungen:

1. **3 Tage vor Ablauf der Zahlungsfrist – freundliche Erinnerung.**
   Freundlicher Ton, Hinweis, dass der Betrag vielleicht schon unterwegs ist. Enthält Kurs, Kind, Betrag, Verwendungszweck, Bankverbindung und das Datum der Zahlungsfrist.

2. **1 Tag vor Ablauf – letzte Erinnerung.**
   Deutlicher Ton: Geht das Geld nicht bis zum Fristende ein, wird der Platz an ein Kind von der Warteliste vergeben und eine erneute Buchung ist gesperrt. Gleiche Zahlungsdaten, dazu die Bitte, sich sofort zu melden, falls etwas dazwischengekommen ist.

Zusätzlich: Wenn die Zahlung eingeht (Haken „bezahlt"), geht keine weitere Erinnerung mehr raus – das prüft der Versand jedes Mal.

Die bestehende interne Prüf-Mail an euch bleibt, damit ihr den Geldeingang im Blick habt.

## Was sich nicht ändert

Der Platz wird **nicht** automatisch entzogen. Nach Fristablauf entscheidet ihr weiterhin selbst über „Kursplatz freigeben" in der Teilnehmerverwaltung – dort wird dann auch der Sperrlisteneintrag gesetzt. Wenn ihr das später automatisch wollt, machen wir das als eigenen Schritt.

## Technische Umsetzung

- Zwei neue Vorlagen in `src/lib/email-templates/`: `payment-due-friendly.tsx` (T-3) und `payment-due-final.tsx` (T-1), beide mit Empfänger = Elternadresse, Zahlungsdaten aus `ORG`/`billing-config` wie in `payment-reminder.tsx`; Registrierung in `registry.ts` und Klartext-Label in `email-template-labels.ts`.
- `src/routes/api/public/hooks/payment-check-reminder.ts` erweitern: Berlin-Datum über die gleiche `berlinTodayPlus`-Logik wie `course-start-reminder.ts` (aktuell UTC-basiert), Abfrage auf `payment_due_date = heute+3` bzw. `= heute+1` statt `<=`, damit nicht jede überfällige Buchung mitgezogen wird. Je Treffer: interne Prüf-Mail (wie bisher, T-3) plus Eltern-Mail mit Idempotenzschlüssel `payment-due-friendly-<id>` bzw. `payment-due-final-<id>`.
- Versand über `queueTemplateEmail` mit `recipientEmail = participant_email`; leere Adresse wird übersprungen.
- Kein neuer Cronjob nötig – der bestehende tägliche Lauf um 8 Uhr deckt beide Zeitpunkte ab.
