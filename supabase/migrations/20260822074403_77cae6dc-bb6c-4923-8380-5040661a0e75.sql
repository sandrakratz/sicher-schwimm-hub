ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS assigned_trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.course_session_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available boolean NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, trainer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_session_availability TO authenticated;
GRANT ALL ON public.course_session_availability TO service_role;

ALTER TABLE public.course_session_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read availability"
  ON public.course_session_availability FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "Trainers manage own availability"
  ON public.course_session_availability FOR ALL
  TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );

CREATE POLICY "Staff manage all availability"
  ON public.course_session_availability FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_course_session_availability_updated
  BEFORE UPDATE ON public.course_session_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_csa_session ON public.course_session_availability(session_id);
CREATE INDEX IF NOT EXISTS idx_csa_trainer ON public.course_session_availability(trainer_id);