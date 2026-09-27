ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS transferred_to_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_from_participant_id uuid REFERENCES public.course_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_reason text,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;