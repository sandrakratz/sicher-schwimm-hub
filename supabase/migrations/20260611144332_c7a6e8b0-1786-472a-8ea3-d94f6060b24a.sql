DROP POLICY IF EXISTS "Members read member document files" ON storage.objects;

CREATE POLICY "Read document files by visibility"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_url = storage.objects.name
        AND (
          d.visibility = 'public'::visibility
          OR (d.visibility = 'members'::visibility AND (has_active_membership(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role)))
          OR (d.visibility = 'trainers'::visibility AND has_role(auth.uid(), 'trainer'::app_role))
        )
    )
  )
);

CREATE POLICY "Public read public document files"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_url = storage.objects.name
      AND d.visibility = 'public'::visibility
  )
);