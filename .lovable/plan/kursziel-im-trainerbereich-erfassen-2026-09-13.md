# Kursziel im Trainerbereich erfassen

Das Kursergebnis (Ziel erreicht, Abzeichen, Anmerkung) wird künftig dort erfasst, wo es entsteht: von der Trainerin oder dem Trainer vor Ort unter „Meine Kurse".

## So wird es aussehen

- Unter „Meine Kurse" bekommt jedes Kind einen Bereich „Kursergebnis" mit:
  - Auswahl: offen / Ziel erreicht / Ziel nicht erreicht
  - Feld „Abzeichen" (z. B. Seepferdchen, Bronze)
  - Feld „Geschafft / Anmerkungen"
  - Speichern-Knopf mit kurzer Bestätigung
- Am Handy steckt das in der aufklappbaren Teilnehmer-Karte, am großen Bildschirm in einer neuen Spalte „Kursergebnis" der Teilnehmertabelle.
- In der Kursverwaltung (/admin/kurse) bleibt das Ergebnis sichtbar (Liste und Teilnehmer-Dialog), ist dort aber nicht mehr änderbar; ein Hinweis nennt den Trainerbereich als Erfassungsstelle.
- Im Elternportal ändert sich nichts – das Ergebnis erscheint dort wie bisher.

## Zugriff

Nur Trainer:innen des jeweiligen Kurses sowie Vorstand/Admin dürfen speichern. Abgemeldete Teilnehmende bleiben ohne Erfassung.

## Technische Umsetzung

- `src/lib/trainer-courses.functions.ts`:
  - `listMyTrainerCourses`: Select um `goal_reached, achievement, badge` erweitern, Typ `TrainerCourse.participants` entsprechend ergänzen.
  - Neue Server-Funktion `updateParticipantResult` (`requireSupabaseAuth`, Muster von `updateParticipantPhone`): prüft Rolle bzw. `is_trainer_of_course` für den Kurs des Teilnehmers, schreibt `goal_reached`, `badge`, `achievement` per `supabaseAdmin`, plus Audit-Log-Eintrag.
- Neue Komponente `src/components/trainer/ParticipantResultEditor.tsx` (lokaler State, Select + zwei Eingabefelder + Speichern, ruft `updateParticipantResult` via `useServerFn`, meldet das Ergebnis nach oben).
- `src/components/trainer/ParticipantCard.tsx`: Felder in `ParticipantCardData` ergänzen, Editor im aufgeklappten Bereich rendern.
- `src/routes/_authenticated/trainer/kurse.tsx`: Spalte „Kursergebnis" in der Desktop-Tabelle mit dem Editor; lokaler State-Abgleich analog zu `applyPhone`.
- `src/routes/_authenticated/admin/kurse.tsx`: im Teilnehmer-Dialog die drei Eingabefelder durch eine Nur-Lese-Anzeige plus Hinweistext ersetzen; die drei Felder aus dem `update`-Aufruf in `savePart` entfernen. Die Spalten-Anzeige in der Teilnehmerliste bleibt unverändert.
