
-- Storage policies for documents bucket
CREATE POLICY "Staff manage document files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'documents' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'documents' AND public.is_staff(auth.uid()));

CREATE POLICY "Members read member document files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_staff(auth.uid())
    OR public.has_active_membership(auth.uid())
  )
);
