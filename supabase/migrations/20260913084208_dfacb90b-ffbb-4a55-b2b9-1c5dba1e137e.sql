DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_entries;
CREATE POLICY "Anyone can join the waitlist"
ON public.waitlist_entries FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'waiting'
  AND offer_token IS NULL
  AND offer_course_id IS NULL
  AND gdpr_consent = true
  AND (parent_user_id IS NULL OR parent_user_id = auth.uid())
);