DROP POLICY IF EXISTS "Staff or trainer manage enrollments" ON public.course_participants;
DROP POLICY IF EXISTS "Users view own enrollments" ON public.course_participants;

CREATE POLICY "Staff manage enrollments" ON public.course_participants
FOR ALL TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Trainers update own course enrollments" ON public.course_participants
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND is_trainer_of_course(auth.uid(), course_id))
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND is_trainer_of_course(auth.uid(), course_id));

CREATE POLICY "Users view own enrollments" ON public.course_participants
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = parent_user_id
  OR is_staff(auth.uid())
  OR (has_role(auth.uid(), 'trainer'::app_role) AND is_trainer_of_course(auth.uid(), course_id))
);