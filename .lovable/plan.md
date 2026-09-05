# Anwesenheit online erfassen

Ja, das geht. Trainer:innen haken die Anwesenheit pro Kurstermin direkt online ab, und die Excel-Kursliste füllt die Terminspalten dann automatisch mit diesen Angaben.

## So funktioniert es später

1. Im Trainerbereich unter „Meine Kurse“ gibt es je Kurs eine Terminauswahl (z. B. „2. Termin – 12.10.2026“).
2. Darunter erscheint die Teilnehmerliste mit je einem Häkchen: anwesend, entschuldigt, gefehlt. Optional ein kurzer Hinweis je Kind.
3. Eintragungen werden sofort gespeichert und können jederzeit korrigiert werden; sichtbar ist, wer wann zuletzt gespeichert hat.
4. In der Excel-Kursliste stehen in den Terminspalten dann automatisch die Kürzel (x = anwesend, e = entschuldigt, f = gefehlt); leere Felder bleiben zum handschriftlichen Eintragen wie bisher.
5. Das Team im Verwaltungsbereich sieht dieselben Anwesenheiten je Kurs (nur lesend bzw. korrigierbar für Vorstand/Admin).

## Umfang

- Zugriff: Nur Trainer:innen des jeweiligen Kurses sowie Vorstand/Admin dürfen erfassen und sehen.
- Kurse ohne angelegte Termine: Hinweis, dass zuerst Termine angelegt werden müssen.
- Abgesagte Teilnehmende werden in der Erfassung nicht angezeigt.

## Technische Umsetzung

- Neue Tabelle `public.course_attendance` mit `session_id` (→ `course_sessions`), `participant_id` (→ `course_participants`), `status` (Enum `attendance_status`: `present`, `excused`, `absent`), `note`, `recorded_by`, `created_at`, `updated_at`, Unique auf (`session_id`, `participant_id`), GRANTs für `authenticated`/`service_role`, RLS über `is_staff()` bzw. `is_trainer_of_course()` (Kurs via Session ermittelt), `updated_at`-Trigger.
- Neue Server-Funktionen `src/lib/attendance.functions.ts`: `listCourseAttendance({ courseId })` und `setAttendance({ sessionId, participantId, status, note })` mit `requireSupabaseAuth` und Rollen-/Kursprüfung, Audit-Log-Eintrag.
- Trainerseite `src/routes/_authenticated/trainer/kurse.tsx`: Termin-Auswahl plus Anwesenheits-Umschalter je Kind (bestehende Tabelle bleibt).
- Admin `src/routes/_authenticated/admin/kurse.tsx`: Anwesenheitsansicht im bestehenden Termine-Dialog.
- Export `src/lib/course-sessions.functions.ts` (`generateCourseListXlsx`): Terminspalten 1–10 werden aus `course_attendance` befüllt (x/e/f), Legende in der Kopfzeile.
