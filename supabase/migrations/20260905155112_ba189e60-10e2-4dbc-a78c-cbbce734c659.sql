CREATE TYPE public.attendance_status AS ENUM ('present','excused','absent');

CREATE TABLE public.course_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.course_participants(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  note text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_id)
);

CREATE INDEX idx_course_attendance_session ON public.course_attendance(session_id);
CREATE INDEX idx_course_attendance_participant ON public.course_attendance(participant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_attendance TO authenticated;
GRANT ALL ON public.course_attendance TO service_role;

ALTER TABLE public.course_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and course trainers can view attendance"
ON public.course_attendance FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.course_sessions cs
    WHERE cs.id = course_attendance.session_id
      AND public.is_trainer_of_course(auth.uid(), cs.course_id)
  )
);

CREATE POLICY "Staff and course trainers can insert attendance"
ON public.course_attendance FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.course_sessions cs
    WHERE cs.id = course_attendance.session_id
      AND public.is_trainer_of_course(auth.uid(), cs.course_id)
  )
);

CREATE POLICY "Staff and course trainers can update attendance"
ON public.course_attendance FOR UPDATE TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.course_sessions cs
    WHERE cs.id = course_attendance.session_id
      AND public.is_trainer_of_course(auth.uid(), cs.course_id)
  )
)
WITH CHECK (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.course_sessions cs
    WHERE cs.id = course_attendance.session_id
      AND public.is_trainer_of_course(auth.uid(), cs.course_id)
  )
);

CREATE POLICY "Staff and course trainers can delete attendance"
ON public.course_attendance FOR DELETE TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.course_sessions cs
    WHERE cs.id = course_attendance.session_id
      AND public.is_trainer_of_course(auth.uid(), cs.course_id)
  )
);

CREATE TRIGGER trg_course_attendance_updated
BEFORE UPDATE ON public.course_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();