DROP POLICY IF EXISTS "Helpers can view signups" ON public.event_shift_signups;
CREATE POLICY "Staff and trainers can view signups"
ON public.event_shift_signups FOR SELECT TO authenticated
USING (is_staff(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role));

DROP POLICY IF EXISTS "Media readable by everyone" ON storage.objects;

CREATE POLICY "Public media readable"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'media'
  AND (
    EXISTS (SELECT 1 FROM public.news n WHERE n.image_url = objects.name AND n.visibility = 'public'::visibility AND n.published)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.image_url = objects.name AND e.visibility = 'public'::visibility)
  )
);

CREATE POLICY "Media readable by audience"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.news n
      WHERE n.image_url = objects.name AND n.published AND (
        n.visibility = 'public'::visibility
        OR (n.visibility = 'members'::visibility AND (has_active_membership(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role)))
        OR (n.visibility = 'trainers'::visibility AND has_role(auth.uid(), 'trainer'::app_role))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.image_url = objects.name AND (
        e.visibility = 'public'::visibility
        OR (e.visibility = 'members'::visibility AND (has_active_membership(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role)))
        OR (e.visibility = 'trainers'::visibility AND has_role(auth.uid(), 'trainer'::app_role))
      )
    )
  )
);