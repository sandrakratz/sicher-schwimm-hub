-- Hinweis an die Eltern, dass sich die Uhrzeit einzelner Termine kurzfristig ändern kann
-- (z. B. wegen Terminen in der Sportschule). Wird bei der Kursplanung aus dem Badplan übernommen.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS time_notice text;
