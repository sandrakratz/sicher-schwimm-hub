ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_due_date date;

ALTER TABLE public.course_participants
  DROP CONSTRAINT IF EXISTS course_participants_payment_method_check;

ALTER TABLE public.course_participants
  ADD CONSTRAINT course_participants_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('transfer','immediate'));