-- Allow authenticated officers to upload checklist evidence into the
-- inspection-files bucket under the app's scoped path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inspection_files_insert_authenticated'
  ) THEN
    CREATE POLICY inspection_files_insert_authenticated
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'inspection-files'
        AND (storage.foldername(name))[1] = 'inspections'
      );
  END IF;
END $$;
