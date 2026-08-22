CREATE TABLE public.course_session_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, trainer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_session_assignments TO authenticated;
GRANT ALL ON public.course_session_assignments TO service_role;

ALTER TABLE public.course_session_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view assignments"
  ON public.course_session_assignments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Staff can insert assignments"
  ON public.course_session_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update assignments"
  ON public.course_session_assignments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete assignments"
  ON public.course_session_assignments FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_course_session_assignments_updated
  BEFORE UPDATE ON public.course_session_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.course_session_assignments (session_id, trainer_id)
SELECT id, assigned_trainer_id FROM public.course_sessions
WHERE assigned_trainer_id IS NOT NULL
ON CONFLICT DO NOTHING;