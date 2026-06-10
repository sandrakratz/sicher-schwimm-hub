GRANT SELECT ON public.news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

DROP POLICY IF EXISTS "Public can read public news" ON public.news;

CREATE POLICY "Anyone can read public news"
ON public.news
FOR SELECT
TO anon, authenticated
USING (published = true AND visibility = 'public'::public.visibility);

CREATE POLICY "Members can read member news"
ON public.news
FOR SELECT
TO authenticated
USING (
  published = true
  AND visibility = 'members'::public.visibility
  AND (public.has_active_membership(auth.uid()) OR public.is_staff(auth.uid()))
);