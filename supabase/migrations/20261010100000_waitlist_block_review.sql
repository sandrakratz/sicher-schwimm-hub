-- Sperrvorschlag bei wiederholten Absagen: „Ignorieren“ merkt sich der Eintrag.
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS block_review_dismissed_at timestamptz;
