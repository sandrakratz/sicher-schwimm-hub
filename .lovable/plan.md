# Trainer-Anwesenheit als Steuernachweis

Ziel: Für jeden Kurstermin ist belegbar, welche Trainer:innen tatsächlich da waren – digital erfasst von der Person selbst und vom Vorstand gegengezeichnet. Das ersetzt die handschriftliche Unterschriftenliste.

## Ablauf

1. Trainer:in sieht im Trainerbereich beim jeweiligen Termin den Schalter „Ich war anwesend“ (ja/nein). Datum, Uhrzeit der Eintragung und Person werden automatisch mitgespeichert und sind nachträglich nicht änderbar, ohne dass es protokolliert wird.
2. Vorstand/Admin sieht im Kurs bzw. im Kalender alle Eintragungen und bestätigt sie mit einem Klick („Bestätigt am … durch …“). Erst bestätigte Einträge gelten als Nachweis.
3. Offene, noch nicht bestätigte Termine werden im Adminbereich hervorgehoben, damit nichts liegen bleibt.

Uhrzeiten werden nicht einzeln erfasst – die Dauer ergibt sich aus der hinterlegten Terminzeit des Kurses.

## Nachweise zum Ausdrucken

- **Kursliste (Excel, bestehend):** Der Trainer-Block wird zur Nachweisliste. Pro Trainer:in und Termin steht „x“ (anwesend, bestätigt), „(x)“ (eingetragen, noch nicht bestätigt) oder leer, dazu Erfassungs- und Bestätigungsdatum. Die Unterschriftenzeile bleibt als Rückfallebene erhalten.
- **Jahresnachweis je Trainer:in (neu):** Im Adminbereich unter „Kurse“ ein Download „Trainer-Nachweis (Jahr)“ – eine Excel-Datei mit einem Blatt pro Trainer:in: alle Termine mit Datum, Kurs, Ort, geplanter Zeit, Anwesenheit und Bestätigung, plus Summenzeile (Anzahl Einsätze, Summe Stunden aus den geplanten Zeiten). Geeignet als Beleg für die Übungsleiterpauschale.

## Rechtlicher Hinweis

Für Finanzamt/Prüfung ist entscheidend, dass der Nachweis zeitnah entsteht, nicht rückwirkend beliebig änderbar ist und von einer zweiten Person bestätigt wird – genau das bildet dieser Ablauf ab. Zusätzlich empfiehlt sich, die Jahresnachweise pro Trainer:in einmal jährlich als PDF/Ausdruck zur Buchhaltung zu legen.

## Technische Umsetzung

- Neue Tabelle `public.trainer_session_attendance`: `session_id`, `trainer_id`, `present boolean`, `note`, `recorded_at`, `recorded_by`, `confirmed_at`, `confirmed_by`; unique auf (session_id, trainer_id). GRANTs für `authenticated`/`service_role`, RLS: Trainer:in darf eigene Zeile lesen/schreiben solange nicht bestätigt; Staff (`is_staff`) darf alles lesen und bestätigen. Änderungen laufen über `audit_logs`.
- `src/lib/trainer-attendance.functions.ts` (neu): `listSessionTrainerAttendance`, `setOwnTrainerAttendance`, `confirmTrainerAttendance` (nur admin/board).
- Trainerbereich (`/trainer` Dashboard und `/trainer/kurse`): pro Termin eine große Schaltfläche „Ich war anwesend“, mobil-tauglich, mit Statusanzeige „vom Vorstand bestätigt“.
- Adminbereich (`/admin/kurse` bzw. `/admin/kalender`): Liste der Eintragungen je Termin mit Sammel-Bestätigung und Hinweis auf offene Bestätigungen.
- `src/lib/course-sessions.functions.ts`: Trainer-Block der Kursliste aus den neuen Daten füllen (x / (x) / leer, Legende erweitern).
- Neue Server-Funktion `generateTrainerProofXlsx({ year })` mit `exceljs`, ein Blatt je Trainer:in inkl. Summen; Download-Button in der Kursverwaltung.

Keine Änderungen an Teilnehmer-Anwesenheit, E-Mails oder öffentlichen Seiten.
