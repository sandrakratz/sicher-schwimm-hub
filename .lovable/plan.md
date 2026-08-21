# Zuweisung aufheben: Anfrage zurück zu „Aktuelle Anfragen“

Aktuell gibt es keinen Weg, eine bereits zugewiesene Anfrage zurückzuholen – eine Anfrage landet im Reiter „Zugewiesene Anfragen“, sobald ein Kurs zugewiesen ist, und dort bleibt sie. Deshalb wird eine Funktion „Zuweisung aufheben“ ergänzt.

## Was neu ist

Im Detail-Dialog einer zugewiesenen Anfrage (Klick auf die Zeile im Reiter „Zugewiesene Anfragen“) erscheint direkt unter „Zugewiesener Kurs“ ein Bereich:

- Button **„Zuweisung aufheben / auf Warteliste“** mit Sicherheitsabfrage
- Auswahl des neuen Status: **Warteliste** (Vorauswahl) oder **Neu**

Nach Bestätigung:

- Der zugewiesene Kurs wird entfernt, die Anfrage erscheint wieder unter „Aktuelle Anfragen“ der jeweiligen Kursgruppe (z. B. Seepferdchen).
- Der Status wird auf „Warteliste“ bzw. „Neu“ gesetzt (farbiges Badge entsprechend).
- Der zugehörige Teilnehmer-Eintrag im Kurs wird auf „storniert“ gesetzt, damit der Platz im Kurs wieder frei wird und das Kind nicht mehr in der Teilnehmerliste/Excel-Auswertung als aktiv zählt.
- Es geht **keine** E-Mail an die Eltern raus; die Kommunikation bleibt im Verlauf erhalten.
- Der Vorgang wird im Änderungsprotokoll vermerkt.

## Technische Details

- Neue Server-Funktion `unassignRequestFromCourse` in `src/lib/course-assignment.functions.ts`:
  - `requireSupabaseAuth` + `is_staff`-Prüfung wie bei `assignRequestToCourse`
  - `course_participants`: Zeilen mit `request_id = requestId` auf `status = 'cancelled'` setzen (kein Löschen, damit Dokumentnummern/Historie erhalten bleiben)
  - `course_requests`: `assigned_course_id = null`, `status = 'waiting_list' | 'new'`
  - Audit-Eintrag `course.participant.unassigned`
- `src/routes/_authenticated/admin/anfragen.tsx`: Abschnitt „Zuweisung“ im Detail-Dialog mit Select + Button (AlertDialog-Bestätigung), danach `load()` und Dialog-State aktualisieren.
