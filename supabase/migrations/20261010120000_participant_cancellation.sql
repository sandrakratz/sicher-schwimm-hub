-- Absage einer Buchung durch die Familie (Teilnehmerliste): Zeitpunkt und Grund festhalten,
-- damit sie in der Anfrageliste und beim Sperrvorschlag mitzählt.
ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
