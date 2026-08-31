# Warteliste: Wunschkurs, Notizen und Mindestalter-Prüfung

## Ziel
Die Wartelistenübersicht im Adminbereich zeigt künftig zu jedem Eintrag den Wunschkurs und die Notizen. Der Wunschkurs kann vom Admin geändert werden; sobald dort ein Platz frei wird, geht das Angebot automatisch raus – aber nur, wenn das Kind zu Kursbeginn das Mindestalter erreicht hat. Die alten Kursanfragen mit Status „Warteliste“ werden in die neue Warteliste übernommen, sodass es nur noch eine Liste gibt.

## 1. Wunschkurs in der Übersicht
- Neue Spalte „Wunschkurs“ mit dem zugeordneten Kursangebot.
- Ist kein Angebot hinterlegt, schlägt das System anhand des Freitextwunsches (aus der alten Anfrage bzw. den Anmerkungen) das am besten passende Angebot vor, z. B. „Vorschlag: Seepferdchen“ mit Button „Übernehmen“.
- Der Admin kann das Angebot jederzeit über ein Auswahlfeld setzen oder ändern; die Liste gruppiert sich danach automatisch neu.

## 2. Notizen
- Neue Spalte „Notiz“: Anmerkung der Eltern (nur lesbar) plus interne Notiz, die der Admin direkt bearbeiten und speichern kann.

## 3. Mindestalter bei der automatischen Zuteilung
- Vor jedem automatischen Platzangebot wird geprüft, ob das Kind am Kursstart das im Angebot hinterlegte Mindestalter erreicht.
- Ist das nicht der Fall, wird der Eintrag für diesen Kurs übersprungen und der nächste Wartende erhält den Platz; das Kind bleibt für spätere, passende Kurse auf der Warteliste.
- Fehlt das Geburtsdatum oder ist kein Mindestalter hinterlegt, wird wie bisher zugeteilt.
- In der Übersicht wird sichtbar, wenn ein Eintrag wegen Mindestalter noch nicht berücksichtigt werden kann („ab TT.MM.JJJJ berücksichtigt“).
- Beim manuellen Angebot durch den Admin erscheint ein Warnhinweis, das Angebot bleibt aber möglich.

## 4. Übernahme der alten Warteliste
- Alle Kursanfragen mit Status „Warteliste“ werden einmalig in die neue Warteliste übertragen – inklusive Kind, Geburtsdatum, Elternkontakt, Wunschkurs (per Textabgleich auf ein Angebot gemappt) sowie Nachricht und interner Notiz.
- Doppelte Einträge (gleiche E-Mail + gleiches Kind) werden nicht erneut angelegt.
- Die separate Liste „Kursanfragen (Warteliste)“ unterhalb der Warteliste entfällt danach; die Ursprungsanfrage bleibt verknüpft und über den Namen aufrufbar.
- Es werden dabei keine E-Mails verschickt.

## Technische Umsetzung
- `src/components/admin/WaitlistAdmin.tsx`: Spalten Wunschkurs (Select über `course_programs`) und Notiz (Eltern-Notiz + editierbare `admin_notes`), Mindestalter-Hinweise.
- `src/lib/waitlist.functions.ts`: `updateWaitlistEntry` um `programId` erweitern; `listWaitlist` liefert zusätzlich `min_age_years` je Programm und den Freitext-Wunsch der verknüpften Anfrage; neue Fn `migrateWaitingRequests` (staff-only, idempotent) für die Übernahme.
- `src/lib/waitlist.server.ts`: Hilfsfunktion `meetsMinAge(childDob, course.starts_on, program.min_age_years)` und Filter in `allocateWaitlist`.
- `src/routes/_authenticated/admin/warteliste.tsx`: `CourseRequestsAdmin mode="waiting"` entfernen.
- Kein Schema-Änderungsbedarf: `waitlist_entries.program_id`, `notes`, `admin_notes`, `request_id` und `course_programs.min_age_years` existieren bereits.
