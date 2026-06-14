DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

DROP POLICY IF EXISTS "Trainers read roles" ON public.user_roles;
CREATE POLICY "Trainers read member roles" ON public.user_roles
  FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role) AND role = 'member'::app_role);