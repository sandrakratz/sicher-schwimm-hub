# Kurszeitraum in der internen Buchungs-E-Mail ergänzen

Bei einer Direktbuchung erhält info@sicher-schwimmen.com aktuell nur "Kursangebot – Kursname". Zeitraum, Kurstage und Ort fehlen, deshalb ist die Zuordnung unklar.

## Was sich ändert

Die interne Benachrichtigung zeigt künftig zusätzlich:

- Kursangebot (z. B. Seepferdchen im Kurhaus)
- Gebuchter Zeitraum (z. B. 11.10.2026 – 08.11.2026)
- Kurstage/Uhrzeit
- Kursort
- Buchungsstatus (verbindlich gebucht / Warteliste)

Auch die Betreffzeile bekommt den Kurs samt Startdatum, damit die Mail schon in der Übersicht zuzuordnen ist.

## Technische Umsetzung

- `src/lib/email-templates/course-request.tsx`: neue optionale Felder `program_name`, `course_name`, `course_starts_on`, `course_ends_on`, `course_schedule`, `course_location`, `booking_status`; zusätzlicher Abschnitt "Gebuchter Kurszeitraum", der nur gerendert wird, wenn Daten vorhanden sind (reine Kursanfragen bleiben unverändert). Datumsformatierung über die bestehenden `Europe/Berlin`-Helfer in `src/lib/format.ts`. Betreff um Kurs/Startdatum erweitert, wenn vorhanden.
- `src/lib/courses-public.functions.ts`: bei der Admin-Mail nach einer Direktbuchung (und im Sperrlisten-Fall) die genannten Kursfelder in `templateData` mitgeben.
