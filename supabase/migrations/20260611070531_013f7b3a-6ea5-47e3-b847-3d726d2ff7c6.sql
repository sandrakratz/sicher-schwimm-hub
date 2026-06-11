ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS goal_reached boolean,
  ADD COLUMN IF NOT EXISTS achievement text,
  ADD COLUMN IF NOT EXISTS badge text;