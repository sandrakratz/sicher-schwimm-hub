-- Fix 1: Revoke anonymous execute on has_active_membership
REVOKE EXECUTE ON FUNCTION public.has_active_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_membership(uuid) TO authenticated;

-- Fix 2: Prevent users from self-promoting profiles.status
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );