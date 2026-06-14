
-- Audit logs: tighten SELECT to admin only, allow authenticated INSERT (for server-side logger)
DROP POLICY IF EXISTS "Staff view audit" ON public.audit_logs;
CREATE POLICY "Admins view audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);
GRANT INSERT ON public.audit_logs TO authenticated;

-- Profiles: trainers may view active member profiles (read-only)
CREATE POLICY "Trainers view active members" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'trainer')
    AND status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'member')
  );

-- user_roles: trainers may read all roles (so member list can show role badges)
CREATE POLICY "Trainers read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

-- Courses: extend management to trainers
DROP POLICY IF EXISTS "Staff manage courses" ON public.courses;
CREATE POLICY "Staff or trainer manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'));

-- Course participants: extend management to trainers
DROP POLICY IF EXISTS "Staff manage enrollments" ON public.course_participants;
CREATE POLICY "Staff or trainer manage enrollments" ON public.course_participants
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'));

DROP POLICY IF EXISTS "Users view own enrollments" ON public.course_participants;
CREATE POLICY "Users view own enrollments" ON public.course_participants
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = parent_user_id
    OR public.is_staff(auth.uid())
    OR public.has_role(auth.uid(), 'trainer')
  );
