# Kursbestätigungen als Rechnungsposten nach WISO MeinVerein Web

WISO MeinVerein Web bietet keine offene Schnittstelle, über die eine Webseite direkt Rechnungen anlegen kann. Der praktikable Weg ist deshalb ein Datei-Export aus der Kursverwaltung, den ihr in MeinVerein importiert.

## Was gebaut wird

In der Kursverwaltung bekommt jeder Kurszeitraum – neben „Excel", „Steuerliste", „Bestätigungen (PDF)" und „ZIP" – einen weiteren Button:

**„MeinVerein (CSV)"**

Der Download enthält alle **bestätigten** Buchungen dieses Zeitraums, eine Zeile pro Rechnungsposten.

## Spalten der Datei

- Rechnungsnummer (Dokument-Nr., z. B. SK-2026-00001)
- Rechnungsdatum (Ausstellungsdatum der Bestätigung)
- Fälligkeitsdatum (Zahlungsziel des Kurses)
- Nachname, Vorname der zahlungspflichtigen Person
- Straße, PLZ, Ort
- E-Mail
- Teilnehmer/in (Name des Kindes)
- Leistung/Position (z. B. „Seepferdchen im Kurhaus, 11.10.2026–08.11.2026")
- Menge (1)
- Einzelpreis / Gesamtbetrag in Euro
- Steuersatz (0 % – § 19 UStG)
- Verwendungszweck (Dokument-Nr. / Name des Kindes)

Format: Semikolon-getrennt, UTF-8 mit BOM, deutsche Zahlen (200,00) und Datumsangaben (TT.MM.JJJJ) – damit Excel und der MeinVerein-Import die Datei sauber einlesen.

## Ablauf für euch

1. Kursverwaltung öffnen, Kursangebot anklicken, beim gewünschten Zeitraum auf „MeinVerein (CSV)" klicken.
2. In MeinVerein Web den Import für Rechnungen/Buchungen starten und die Spalten einmalig zuordnen; die Zuordnung merkt sich MeinVerein für spätere Importe.
3. Beim ersten Import mit einem Kurs testen und die Feldzuordnung ggf. anpassen.

Falls MeinVerein beim Rechnungsimport andere Spaltennamen erwartet, passe ich die Kopfzeile nach eurem ersten Testimport an – die Datenbasis bleibt gleich.

## Technisches

- Neue Server-Funktion `generateMeinVereinCsv` in `src/lib/course-sessions.functions.ts`, analog zu `generateTaxParticipantListXlsx`: `requireSupabaseAuth`, Rollenprüfung admin/board/trainer, Rückgabe als Base64 + Dateiname (`MeinVerein_<Kurs>_<Startdatum>.csv`).
- Datenquelle: `course_participants` (status = confirmed) mit `document_no`, `document_issued_at`, `payer_street/zip/city`, `price_amount`, `participant_name/email`, verknüpft mit `course_requests.parent_name` und den Kursdaten aus `courses`/`course_programs`.
- Fälligkeit über die bestehende `computeDueDate`-Logik aus `src/lib/course-confirmation.ts`, damit CSV, PDF und E-Mail identisch sind.
- Buchungen ohne Dokument-Nr. (Altbestand) werden mit leerer Rechnungsnummer exportiert und in der Datei am Ende gelistet, damit nichts stillschweigend fehlt.
- Audit-Eintrag `meinverein_csv_exported`.
- UI-Änderung nur in `src/routes/_authenticated/admin/kurse.tsx` (Button + bestehende Base64-Download-Logik).
- Keine Datenbank- oder Rechteänderungen nötig.
