# Trainer-Verfügbarkeit für Kurstermine

Trainer melden pro Kurstermin mit einem Klick „Kann“ oder „Kann nicht“. Das Admin-Team sieht alle Rückmeldungen und teilt pro Termin verbindlich einen Trainer ein.

## Für Trainer: neue Seite „Meine Verfügbarkeit“

- Neuer Menüpunkt im internen Bereich, sichtbar für Trainer, Admin und Vorstand.
- Liste aller kommenden Kurstermine (Vergangenes ausgeblendet), gruppiert nach Kurs, chronologisch sortiert:
  - Datum + Wochentag, Kursname, Ort, Uhrzeit/Zeitplan aus dem Kurs.
  - Zwei Buttons pro Termin: „Kann“ (grün, wenn gewählt) und „Kann nicht“ (rot, wenn gewählt); erneutes Klicken hebt die Angabe wieder auf.
  - Direkt daneben klein: wer sonst schon zugesagt hat, und ob man selbst eingeteilt ist („Du bist eingeteilt“).
- Zusätzlich Schnellaktionen pro Kurs: „Alle Termine: Kann“ / „Alle: Kann nicht“, damit die Ersterfassung schnell geht.
- Speichern erfolgt sofort beim Klick, ohne Formular.

## Für Admin/Vorstand: Übersicht und Einteilung

Im bestehenden Termine-Dialog der Kursverwaltung bekommt jeder Termin:

- eine Zeile mit den Rückmeldungen: grüne Namen (kann), rote Namen (kann nicht), Rest „keine Rückmeldung“.
- ein Auswahlfeld „Anwesend/eingeteilt“ mit allen Trainern; zugesagte Trainer stehen oben, abgesagte sind gekennzeichnet. Auswahl wird sofort gespeichert und ist für die Trainer sichtbar.
- Warnhinweis am Termin, wenn niemand eingeteilt ist oder der Eingeteilte inzwischen abgesagt hat.

## Technisches

- Migration:
  - Neue Tabelle `course_session_availability` (`session_id`, `trainer_id`, `available` boolean, Zeitstempel), eindeutig pro Termin+Trainer. Rechte: Trainer/Admin/Vorstand dürfen alle Einträge lesen; jeder darf nur seine eigenen Einträge anlegen/ändern/löschen; Admin/Vorstand dürfen alles. GRANTs für `authenticated` und `service_role`, RLS aktiv, `updated_at`-Trigger.
  - Neue Spalte `assigned_trainer_id` in `course_sessions` (Einteilung durch Admin/Vorstand). Bestehende Schreibrechte auf `course_sessions` bleiben bei Team-Rollen.
  - Kleine Hilfsfunktion/Policy-Bedingung nutzt die vorhandenen `has_role`/`is_staff`-Funktionen.
- Trainerliste: Nutzer mit Rolle `trainer` (plus `admin`/`board`), Namen aus `profiles`, geladen über eine neue Server-Funktion mit Rollenprüfung, da `user_roles` für Trainer eingeschränkt ist.
- Neue Route `src/routes/_authenticated/admin/verfuegbarkeit.tsx` sowie Navigationseintrag in `src/routes/_authenticated/admin/route.tsx` (`allow: admin, board, trainer`).
- Erweiterung des Termine-Dialogs in `src/routes/_authenticated/admin/kurse.tsx` um Rückmeldungen und Einteilungs-Auswahl.
- Keine E-Mails, keine Änderungen an öffentlichen Seiten.
