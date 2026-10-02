-- Benötigte Trainer:innen pro Kurstermin (Dienstplan / Kurskalender).
-- Bisher galt überall fest „2“, das bleibt als Vorgabe erhalten.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS trainers_needed smallint NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_trainers_needed_range') THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_trainers_needed_range CHECK (trainers_needed BETWEEN 1 AND 10);
  END IF;
END $$;
