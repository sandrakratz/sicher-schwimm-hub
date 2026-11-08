-- Dienstplan-Protokoll: nur der Administrator darf lesen (nicht der übrige Vorstand)
DROP POLICY IF EXISTS "Staff read dienstplan log" ON public.dienstplan_log;

CREATE POLICY "Admin read dienstplan log"
  ON public.dienstplan_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
