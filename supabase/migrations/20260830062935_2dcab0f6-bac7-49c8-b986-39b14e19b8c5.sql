-- Trainer dürfen Kurstermine nur noch für eigene Kurse schreiben.
DROP POLICY IF EXISTS "Staff can insert course sessions" ON public.course_sessions;
DROP POLICY IF EXISTS "Staff can update course sessions" ON public.course_sessions;
DROP POLICY IF EXISTS "Staff can delete course sessions" ON public.course_sessions;

CREATE POLICY "Staff can insert course sessions"
  ON public.course_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    OR (
      public.has_role(auth.uid(), 'trainer'::app_role)
      AND public.is_trainer_of_course(auth.uid(), course_id)
    )
  );

CREATE POLICY "Staff can update course sessions"
  ON public.course_sessions FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (
      public.has_role(auth.uid(), 'trainer'::app_role)
      AND public.is_trainer_of_course(auth.uid(), course_id)
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR (
      public.has_role(auth.uid(), 'trainer'::app_role)
      AND public.is_trainer_of_course(auth.uid(), course_id)
    )
  );

CREATE POLICY "Staff can delete course sessions"
  ON public.course_sessions FOR DELETE TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (
      public.has_role(auth.uid(), 'trainer'::app_role)
      AND public.is_trainer_of_course(auth.uid(), course_id)
    )
  );