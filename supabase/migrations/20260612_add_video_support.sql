-- Add video support to inspection_files
-- file_type already exists as text — allowed values include 'image', 'document', 'video'
ALTER TABLE public.inspection_files
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS thumbnail_url   text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_inspection_files_type
  ON public.inspection_files(file_type);

-- RLS: management and audit roles can also SELECT inspection_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inspection_files'
      AND policyname = 'inspection_files select management'
  ) THEN
    CREATE POLICY "inspection_files select management" ON public.inspection_files
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.inspections i
          WHERE i.id = inspection_id
            AND public.current_user_role() IN ('management', 'audit', 'head', 'admin')
        )
      );
  END IF;
END
$$;

-- MANUAL (Supabase Dashboard → Storage → inspection-files bucket):
-- 1. Allowed MIME types: video/mp4, video/quicktime, video/webm
-- 2. Max file size: 500MB
-- 3. Bucket RLS already keys off inspection_id — videos use the same paths/policies as images
