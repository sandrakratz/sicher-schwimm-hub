CREATE TABLE public.trainer_session_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT true,
  note text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  confirmed_at timestamp with time zone,
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, trainer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_session_attendance TO authenticated;
GRANT ALL ON public.trainer_session_attendance TO service_role;

ALTER TABLE public.trainer_session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all trainer attendance"
  ON public.trainer_session_attendance FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR trainer_id = auth.uid());

CREATE POLICY "Trainers record own attendance"
  ON public.trainer_session_attendance FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Trainers update own unconfirmed attendance"
  ON public.trainer_session_attendance FOR UPDATE TO authenticated
  USING ((trainer_id = auth.uid() AND confirmed_at IS NULL) OR public.is_staff(auth.uid()))
  WITH CHECK (trainer_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Staff delete trainer attendance"
  ON public.trainer_session_attendance FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) OR (trainer_id = auth.uid() AND confirmed_at IS NULL));

CREATE TRIGGER update_trainer_session_attendance_updated_at
  BEFORE UPDATE ON public.trainer_session_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();