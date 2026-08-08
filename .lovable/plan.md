# Teilnehmerliste für die Steuer als Download

Zusätzlich zur bestehenden druckbaren „Excel"-Kursliste gibt es künftig einen zweiten Export: **„Teilnehmerliste (Steuer)"** – eine vollständige Datenliste pro Kurszeitraum.

## Wo

In der Kursverwaltung, in der Zeitraum-Zeile der Kurs-Detailansicht, neben dem bestehenden Excel-Button ein zusätzlicher Button **„Steuerliste"**. Verfügbar, sobald der Kurs gestartet ist (Startdatum erreicht) sowie für archivierte/erledigte Zeiträume; vor Kursbeginn ist der Button deaktiviert mit Hinweis „ab Kursbeginn verfügbar".

## Inhalt der Datei (Excel, eine Zeile je Teilnehmer)

- Nr.
- Name des Kindes
- Geburtsdatum, Alter bei Kursbeginn
- Name Eltern/Kontakt, E-Mail, Telefon
- Mitglied (ja/nein)
- Status (bestätigt / Warteliste / storniert)
- Buchungsart (online gebucht / manuell)
- Zu zahlender Betrag (€)
- Bezahlt (ja/nein), Bezahlt am (Datum)
- Zahlungsnotiz
- Anmeldedatum

Kopfbereich: Kursname, Ort, Zeitraum, Zeitplan, Erstelldatum.
Fußzeile: Summenzeile mit Anzahl Teilnehmer, Summe Soll-Beträge, Summe bezahlt, Summe offen.

Standardmäßig sind stornierte Teilnehmer enthalten (für die Nachvollziehbarkeit), aber als „storniert" gekennzeichnet und nicht in den Summen der bezahlten Beträge doppelt gewertet.

## Technisches

- Neue Server-Funktion `generateTaxParticipantListXlsx` in `src/lib/course-sessions.functions.ts`, analog zur bestehenden `generateCourseListXlsx`: `requireSupabaseAuth`, Rollenprüfung auf admin/board/trainer, ExcelJS, Rückgabe als Base64 + Dateiname (`Teilnehmerliste_Steuer_<Kurs>_<Startdatum>.xlsx`).
- Felder kommen aus `course_participants` (participant_name, participant_email, participant_phone, date_of_birth, status, is_member, online_booking, price_amount, paid, paid_at, payment_note, created_at) plus `courses` für Kopfdaten.
- Beträge als Zahl mit Format `#,##0.00 €`, Datumsangaben deutsch (Europe/Berlin), Summenzeile als Excel-Formel (SUM), damit die Datei nachrechenbar bleibt.
- Audit-Eintrag `tax_participant_list_exported` wie beim bestehenden Export.
- UI-Änderung nur in `src/routes/_authenticated/admin/kurse.tsx` (Button + Download-Handler, gleiche Base64-Download-Logik wie bisher).
- Keine Datenbank- oder Rechteänderungen nötig.
