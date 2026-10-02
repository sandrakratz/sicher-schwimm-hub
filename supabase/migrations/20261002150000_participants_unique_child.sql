-- Dasselbe Kind (Name + Geburtsdatum) darf in einem Kurs nur einmal aktiv eingetragen sein.
-- Absicherung zusätzlich zur Prüfung in book_course_seat (z. B. für Admin-Wege und Umbuchungen).
-- Voraussetzung: keine Dubletten (Abfrage B im Entwurf war leer). Abgesagte Einträge (cancelled) zählen nicht.
CREATE UNIQUE INDEX IF NOT EXISTS course_participants_one_active_child_per_course
  ON public.course_participants (course_id, lower(btrim(participant_name)), date_of_birth)
  WHERE status <> 'cancelled' AND date_of_birth IS NOT NULL AND participant_name IS NOT NULL;
