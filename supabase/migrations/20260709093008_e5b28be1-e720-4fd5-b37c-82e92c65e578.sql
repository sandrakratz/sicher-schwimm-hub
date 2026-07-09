
DROP POLICY IF EXISTS "Authenticated can view course sessions" ON public.course_sessions;

CREATE POLICY "Staff can view course sessions"
ON public.course_sessions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'board'::app_role)
  OR public.has_role(auth.uid(), 'trainer'::app_role)
);

CREATE POLICY "Participants can view their course sessions"
ON public.course_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_participants cp
    WHERE cp.course_id = course_sessions.course_id
      AND (cp.parent_user_id = auth.uid() OR cp.user_id = auth.uid())
  )
);
