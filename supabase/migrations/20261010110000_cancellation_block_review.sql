-- Sperrvorschlag: „Ignorieren“ muss auch bei Familien möglich sein, die nur Stornierungen
-- (aber keinen Wartelisteneintrag) haben.
ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS block_review_dismissed_at timestamptz;
