-- Restore inspection media access for dashboard roles and officers after the
-- secure bucket migration restricted reads to JWT role claims that are not set.

DROP POLICY IF EXISTS inspection_files_owner_or_staff_select ON storage.objects;
DROP POLICY IF EXISTS inspection_files_owner_path_insert ON storage.objects;

CREATE POLICY inspection_files_staff_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inspection-files'
    AND (
      public.current_user_role() IN ('admin', 'head', 'management', 'audit')
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.inspections i
        WHERE i.officer_id = public.current_user_roles_id()
          AND (storage.foldername(name))[1] = 'inspections'
          AND (storage.foldername(name))[2] = i.id::text
      )
    )
  );
