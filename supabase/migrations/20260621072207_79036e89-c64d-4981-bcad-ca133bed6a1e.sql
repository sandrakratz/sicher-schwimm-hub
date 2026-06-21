
CREATE TABLE public.course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_index integer NOT NULL CHECK (session_index BETWEEN 1 AND 10),
  session_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, session_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sessions TO authenticated;
GRANT ALL ON public.course_sessions TO service_role;

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view course sessions"
  ON public.course_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert course sessions"
  ON public.course_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'board') OR public.has_role(auth.uid(),'trainer'));

CREATE POLICY "Staff can update course sessions"
  ON public.course_sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'board') OR public.has_role(auth.uid(),'trainer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'board') OR public.has_role(auth.uid(),'trainer'));

CREATE POLICY "Staff can delete course sessions"
  ON public.course_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'board') OR public.has_role(auth.uid(),'trainer'));

CREATE TRIGGER update_course_sessions_updated_at
  BEFORE UPDATE ON public.course_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
