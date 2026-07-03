-- Lock down inspection-files bucket: private bucket, no anon access.

UPDATE storage.buckets
SET public = false
WHERE id = 'inspection-files';

DROP POLICY IF EXISTS inspection_files_select_public ON storage.objects;

DROP POLICY IF EXISTS inspection_files_select_authenticated ON storage.objects;

CREATE POLICY inspection_files_owner_or_staff_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inspection-files'
    AND (
      owner = auth.uid()
      OR COALESCE(auth.jwt() ->> 'role', '') IN ('admin', 'head', 'executive')
    )
  );

CREATE POLICY inspection_files_owner_path_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
