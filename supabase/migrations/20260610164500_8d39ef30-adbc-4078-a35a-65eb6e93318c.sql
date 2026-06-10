DROP POLICY IF EXISTS "Members read member document files" ON storage.objects;
CREATE POLICY "Members read member document files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents'
  AND (
    public.is_staff(auth.uid())
    OR public.has_active_membership(auth.uid())
    OR public.has_role(auth.uid(), 'trainer')
  )
);