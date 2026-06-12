-- Canonical storage INSERT policies for inspection evidence uploads.
-- Removes the legacy broad insert policy and ensures officers can upload to
-- inspections they own while draft or submitted (edit flow).

DROP POLICY IF EXISTS inspection_files_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS inspection_files_officer_draft_insert ON storage.objects;
DROP POLICY IF EXISTS inspection_files_staff_insert ON storage.objects;

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
        AND i.status IN ('draft', 'submitted')
    )
  );

CREATE POLICY inspection_files_staff_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-files'
    AND (storage.foldername(name))[1] = 'inspections'
    AND public.current_user_role() IN ('admin', 'head', 'management')
  );
