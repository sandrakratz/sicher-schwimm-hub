DROP POLICY IF EXISTS "Visibility-based events" ON public.events;

CREATE POLICY "Visibility-based events"
ON public.events
FOR SELECT
USING (
  visibility = 'public'::visibility
  OR (
    visibility = 'members'::visibility
    AND (
      has_active_membership(auth.uid())
      OR has_role(auth.uid(), 'trainer'::app_role)
      OR is_staff(auth.uid())
    )
  )
  OR (
    visibility = 'trainers'::visibility
    AND (
      has_role(auth.uid(), 'trainer'::app_role)
      OR is_staff(auth.uid())
    )
  )
  OR (
    visibility = 'admin'::visibility
    AND is_staff(auth.uid())
  )
);

-- Allow anonymous (logged-out) visitors to see public events on the marketing site
GRANT SELECT ON public.events TO anon;