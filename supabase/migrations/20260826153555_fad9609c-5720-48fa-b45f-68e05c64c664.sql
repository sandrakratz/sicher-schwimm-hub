CREATE OR REPLACE FUNCTION public.is_trainer_of_course(_trainer_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        c.trainer_id = _trainer_id
        OR EXISTS (
          SELECT 1 FROM public.course_sessions cs
          WHERE cs.course_id = c.id
            AND (
              cs.assigned_trainer_id = _trainer_id
              OR EXISTS (
                SELECT 1 FROM public.course_session_assignments csa
                WHERE csa.session_id = cs.id AND csa.trainer_id = _trainer_id
              )
            )
        )
      )
  )
$$;

DROP POLICY IF EXISTS "Staff or trainer manage courses" ON public.courses;
DROP POLICY IF EXISTS "Public can view public courses" ON public.courses;

CREATE POLICY "Public can view public courses"
ON public.courses FOR SELECT
TO anon, authenticated
USING (
  is_public = true
  OR public.is_staff(auth.uid())
  OR public.is_trainer_of_course(auth.uid(), id)
);

CREATE POLICY "Staff manage courses"
ON public.courses FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff or trainer manage programs" ON public.course_programs;

CREATE POLICY "Staff manage programs"
ON public.course_programs FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));