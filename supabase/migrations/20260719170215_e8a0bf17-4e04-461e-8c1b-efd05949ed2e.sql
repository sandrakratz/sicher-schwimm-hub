
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS sender_user_id uuid;

DROP POLICY IF EXISTS "Staff can read email send log" ON public.email_send_log;
CREATE POLICY "Staff can read email send log"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
