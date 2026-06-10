DROP POLICY IF EXISTS "Visibility-based docs" ON public.documents;
CREATE POLICY "Visibility-based docs" ON public.documents
FOR SELECT USING (
  visibility = 'public'::visibility
  OR (visibility = 'members'::visibility AND (public.has_active_membership(auth.uid()) OR public.has_role(auth.uid(), 'trainer') OR public.is_staff(auth.uid())))
  OR (visibility = 'trainers'::visibility AND (public.has_role(auth.uid(), 'trainer') OR public.is_staff(auth.uid())))
  OR public.is_staff(auth.uid())
);