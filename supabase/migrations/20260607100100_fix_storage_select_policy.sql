-- Ensure inspection image URLs are readable from reports.

UPDATE storage.buckets
SET public = true
WHERE id = 'inspection-files';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inspection_files_select_authenticated'
  ) THEN
    CREATE POLICY inspection_files_select_authenticated
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'inspection-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inspection_files_select_public'
  ) THEN
    CREATE POLICY inspection_files_select_public
      ON storage.objects
      FOR SELECT
      TO anon
      USING (bucket_id = 'inspection-files');
  END IF;
END $$;
