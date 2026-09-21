ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS exam_level text,
  ADD COLUMN IF NOT EXISTS exam_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS exam_pass_no text,
  ADD COLUMN IF NOT EXISTS exam_recorded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS exam_recorded_at timestamp with time zone;

COMMENT ON COLUMN public.course_participants.exam_criteria IS 'Abgehakte Teilleistungen nach DPO, z.B. {"sprung":{"done":true,"value":"14:20"}}';