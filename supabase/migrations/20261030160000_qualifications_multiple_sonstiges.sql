-- Mehrere „Sonstige“ Nachweise pro Trainer:in (z. B. Trainerausbildung Baby-/Kleinkinderschwimmen UND
-- Fachkraft für Kleinkindpädagogik). Bisher war (trainer_id, kind) eindeutig, ein zweiter Eintrag hat den ersten überschrieben.
-- Alle anderen Arten bleiben pro Person einmalig.

ALTER TABLE public.trainer_qualifications
  DROP CONSTRAINT IF EXISTS trainer_qualifications_trainer_id_kind_key;

CREATE UNIQUE INDEX IF NOT EXISTS trainer_qualifications_one_per_kind
  ON public.trainer_qualifications (trainer_id, kind)
  WHERE kind <> 'sonstiges';
