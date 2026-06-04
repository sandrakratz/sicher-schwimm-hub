
DROP POLICY IF EXISTS "Anyone can submit request" ON public.course_requests;
CREATE POLICY "Submit course request"
ON public.course_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'::request_status
  AND assigned_course_id IS NULL
  AND admin_notes IS NULL
);

DROP POLICY IF EXISTS "Anyone can send message" ON public.messages;
CREATE POLICY "Send message"
ON public.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND internal_notes IS NULL
  AND (
    (auth.uid() IS NULL AND from_user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (from_user_id IS NULL OR from_user_id = auth.uid()))
  )
);
