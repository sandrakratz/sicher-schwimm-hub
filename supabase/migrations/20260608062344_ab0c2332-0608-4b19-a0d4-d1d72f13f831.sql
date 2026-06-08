
CREATE OR REPLACE FUNCTION public.has_active_membership(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND status = 'active'
  )
$$;

DROP POLICY IF EXISTS "Public can read public news" ON public.news;
CREATE POLICY "Public can read public news" ON public.news
  FOR SELECT TO anon, authenticated
  USING (
    published = true AND (
      visibility = 'public'::visibility
      OR (visibility = 'members'::visibility AND (public.has_active_membership(auth.uid()) OR public.is_staff(auth.uid())))
      OR public.is_staff(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Visibility-based docs" ON public.documents;
CREATE POLICY "Visibility-based docs" ON public.documents
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'::visibility
    OR (visibility = 'members'::visibility AND (public.has_active_membership(auth.uid()) OR public.is_staff(auth.uid())))
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Visibility-based events" ON public.events;
CREATE POLICY "Visibility-based events" ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'::visibility
    OR (visibility = 'members'::visibility AND (public.has_active_membership(auth.uid()) OR public.is_staff(auth.uid())))
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Apply for membership" ON public.memberships;
CREATE POLICY "Apply for membership" ON public.memberships
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
    )
    AND status = 'pending'::membership_status
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND notes IS NULL
  );
