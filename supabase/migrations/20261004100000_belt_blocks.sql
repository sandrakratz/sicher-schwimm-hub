-- Gurt-Stand des Kindes: Anzahl der Schwimmklötzchen am Gurt (6 = Anfänger, je mehr das Kind kann,
-- desto mehr Klötzchen werden entfernt, 0 = schwimmt ohne Gurt).
-- NULL = nicht erfasst (nicht gleichbedeutend mit 0!).
-- Der Wert gehört zur Buchung (Stand im jeweiligen Kurs). Bei einer erneuten Buchung wird der Stand des
-- letzten früheren Kurses desselben Kindes (Name + Geburtsdatum) angezeigt und kann übernommen werden.
ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS belt_blocks smallint
  CHECK (belt_blocks IS NULL OR belt_blocks BETWEEN 0 AND 6);

COMMENT ON COLUMN public.course_participants.belt_blocks IS
  'Klötzchen am Schwimmgurt (6 = Anfänger … 0 = ohne Gurt), NULL = nicht erfasst';

-- Schnelles Nachschlagen des letzten Stands eines Kindes
CREATE INDEX IF NOT EXISTS course_participants_belt_lookup
  ON public.course_participants (date_of_birth)
  WHERE belt_blocks IS NOT NULL;
