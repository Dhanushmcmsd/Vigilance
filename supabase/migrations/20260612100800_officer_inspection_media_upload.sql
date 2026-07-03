-- Ensure officers can upload evidence to draft inspections they own.

DROP POLICY IF EXISTS inspection_files_officer_draft_insert ON storage.objects;

CREATE POLICY inspection_files_officer_draft_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-files'
    AND (storage.foldername(name))[1] = 'inspections'
    AND EXISTS (
      SELECT 1
      FROM public.inspections i
      WHERE i.id::text = (storage.foldername(name))[2]
        AND i.officer_id = public.current_user_roles_id()
        AND i.status = 'draft'
    )
  );
