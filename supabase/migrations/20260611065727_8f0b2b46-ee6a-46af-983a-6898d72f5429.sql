
DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('confirmed','waiting','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.course_participants
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS participant_name text,
  ADD COLUMN IF NOT EXISTS participant_email text,
  ADD COLUMN IF NOT EXISTS participant_phone text,
  ADD COLUMN IF NOT EXISTS status public.enrollment_status NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.course_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.course_participants
  DROP CONSTRAINT IF EXISTS course_participants_identity_chk;
ALTER TABLE public.course_participants
  ADD CONSTRAINT course_participants_identity_chk
  CHECK (user_id IS NOT NULL OR participant_name IS NOT NULL);

DROP TRIGGER IF EXISTS trg_course_participants_updated ON public.course_participants;
CREATE TRIGGER trg_course_participants_updated BEFORE UPDATE ON public.course_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
