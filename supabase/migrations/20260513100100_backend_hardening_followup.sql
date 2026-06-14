-- ============================================================
-- VIGILANCE MANAGEMENT SYSTEM — BACKEND HARDENING FOLLOW-UP
-- Date: 2026-05-13
-- Companion to 20260513_backend_hardening.sql.
-- Run AFTER the main migration. Idempotent — safe to re-run.
-- ============================================================
-- Does:
--   1. Backfills user_roles.email from auth.users (the column existed in the
--      base schema's edge function code, but never had a value).
--   2. Creates the `inspection-files` storage bucket if missing + adds basic
--      bucket-level RLS so officers can only read/upload their own files.
--   3. Ensures the realtime publication actually contains all critical
--      tables (the main migration added `notifications`; this re-asserts
--      `inspections` and `escalation_tickets` so nothing falls out of sync).
--   4. Sanity-check queries (commented out) at the very end — uncomment
--      individually to verify the migration landed cleanly in your project.
-- ============================================================

-- ── 1) Backfill user_roles.email ───────────────────────────────────────────

DO $$
DECLARE
  updated_rows int;
BEGIN
  UPDATE public.user_roles ur
     SET email = au.email
    FROM auth.users au
   WHERE ur.user_id = au.id
     AND (ur.email IS NULL OR ur.email = '');

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RAISE NOTICE 'user_roles.email backfilled for % rows', updated_rows;
END
$$;

-- Keep email in sync with auth.users automatically going forward.
CREATE OR REPLACE FUNCTION public.sync_user_role_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_roles
     SET email = NEW.email
   WHERE user_id = NEW.id
     AND (email IS DISTINCT FROM NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_role_email ON auth.users;
CREATE TRIGGER trg_sync_user_role_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_email();

-- ── 2) Storage bucket: inspection-files ────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-files',
  'inspection-files',
  false,                                              -- private bucket
  52428800,                                           -- 50 MB max per file
  ARRAY[
    'image/jpeg','image/png','image/webp','image/heic',
    'application/pdf','application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
   SET file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types,
       public = false;

-- Storage RLS — officers can read/upload to their own folder, head/admin can
-- read everything. The folder convention is `<inspection_id>/<file>`, so we
-- match on the leading segment.

DROP POLICY IF EXISTS "Officers read own inspection files"   ON storage.objects;
DROP POLICY IF EXISTS "Officers upload own inspection files" ON storage.objects;
DROP POLICY IF EXISTS "Head/admin read all inspection files" ON storage.objects;

CREATE POLICY "Officers read own inspection files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'inspection-files'
    AND EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id::text = split_part(name, '/', 1)
        AND i.officer_id = public.current_user_roles_id()
    )
  );

CREATE POLICY "Officers upload own inspection files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-files'
    AND EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id::text = split_part(name, '/', 1)
        AND i.officer_id = public.current_user_roles_id()
    )
  );

CREATE POLICY "Head/admin read all inspection files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'inspection-files'
    AND public.current_user_role() IN ('head','management','admin')
  );

-- ── 3) Realtime publication — re-assert critical tables ───────────────────

DO $$
DECLARE
  t text;
  required text[] := ARRAY['inspections','notifications','escalation_tickets'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication missing — skipping';
    RETURN;
  END IF;

  FOREACH t IN ARRAY required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'added %I to supabase_realtime', t;
    END IF;
  END LOOP;
END
$$;

-- ── 4) Sanity checks (UNCOMMENT one at a time after applying) ─────────────

-- -- Confirm sync_status / device_id / app_version landed:
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'inspections'
--    AND column_name IN ('sync_status','device_id','app_version','deleted_at');

-- -- Confirm soft-delete columns:
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE table_schema='public' AND column_name='deleted_at';

-- -- Confirm the new SELECT policies on inspections:
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE schemaname='public' AND tablename='inspections' AND cmd='SELECT';

-- -- Confirm bucket created:
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id='inspection-files';

-- -- Spot-check email backfill:
-- SELECT count(*) FILTER (WHERE email IS NOT NULL) AS with_email,
--        count(*) FILTER (WHERE email IS NULL)     AS missing_email
--   FROM public.user_roles;

-- ============================================================
-- END OF FOLLOW-UP
-- ============================================================
