# Abmeldung aus einem Kurs: mit oder ohne E-Mail an die Eltern

## Empfehlung

Alles über den Mülleimer (den vorhandenen Dialog „Aus Kurs entfernen“) – nicht über die Statusauswahl.

Gründe:
- Im Mülleimer-Dialog wird bereits Grund und Sperrliste abgefragt. Dort passt die Frage „Eltern benachrichtigen?“ nahtlos dazu.
- Die Statusauswahl wird auch für Alltagsfälle benutzt (z. B. zurück auf die Warteliste) – dort würde eine E-Mail schnell versehentlich ausgelöst.

## Wie der Dialog künftig aussieht

Nach der Auswahl des Grundes erscheint eine Auswahl, welche E-Mail an die Eltern geht:

1. **Platz freigegeben (keine Rückmeldung/Zahlung)** – Standard, wenn als Grund „Nichtzahlung“ gewählt ist.
   Inhalt: Der Platz wurde mangels Rückmeldung bzw. Zahlung wieder freigegeben. Eine Online-Buchung weiterer Kurse ist nicht mehr möglich; Anfragen bitte direkt an den Vorstand.
   Diese Auswahl setzt automatisch auch den Haken für die Sperrliste.

2. **Abmeldung wie besprochen (z. B. Krankheit)** – freundlicher, kurzer Text: Wie besprochen wurde die Teilnahme des Kindes an diesem Kurs storniert. Keine Sperrliste, Hinweis auf spätere Kurse/Warteliste.

3. **Keine E-Mail senden** – nur entfernen (z. B. Dubletten, interne Korrekturen).

Zusätzlich: ein optionales Freitextfeld „Persönliche Ergänzung“, das in beiden E-Mails unter dem Standardtext erscheint.

Vor dem Absenden zeigt der Dialog klar an: an welche Adresse die E-Mail geht bzw. dass keine E-Mail versandt wird. Fehlt eine E-Mail-Adresse, wird der Versand deaktiviert und ein Hinweis eingeblendet.

Nach dem Entfernen meldet die Bestätigung, ob die E-Mail versendet wurde. Der Versand wird wie gewohnt im Sendeprotokoll und in der Historie gespeichert; ein fehlgeschlagener Versand verhindert das Entfernen nicht.

## Technische Umsetzung

- Zwei neue Vorlagen unter `src/lib/email-templates/`:
  - `course-removal-unpaid.tsx` (Platz freigegeben, keine Online-Buchung mehr)
  - `course-removal-agreed.tsx` (Abmeldung wie besprochen)
  Beide in `registry.ts` und in `src/lib/email-template-labels.ts` mit deutschen Bezeichnungen eintragen.
- `removeCourseParticipant` in `src/lib/participants-admin.functions.ts` erhält zwei zusätzliche Felder: `notify: 'unpaid' | 'agreed' | 'none'` und `note?: string`. Nach erfolgreichem Löschen wird `queueTemplateEmail` (aus `src/lib/email-send.server.ts`) mit Kursname, Kindname und optionaler Ergänzung aufgerufen; Idempotenzschlüssel aus Teilnehmer-ID und Vorlage. Versandfehler werden protokolliert, aber nicht geworfen. Der gewählte Versandtyp landet zusätzlich in den Audit-Metadaten.
- Der Entfernen-Dialog in `src/routes/_authenticated/admin/kurse.tsx` bekommt die Auswahl, das Ergänzungsfeld und die Empfängeranzeige; Grund „Nichtzahlung“ setzt Vorauswahl 1 plus Sperrliste.
- Kursdaten (Name, Startdatum) werden beim Laden des Teilnehmers zusätzlich abgefragt, damit die E-Mail den Kurs benennt.
