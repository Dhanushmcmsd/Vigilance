-- ============================================================
-- VIGILANCE — AUDIT ROLE MIGRATION
-- Read-only audit users: all submitted inspections + related rows
-- ============================================================

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('officer', 'head', 'management', 'admin', 'audit'));

COMMENT ON COLUMN public.user_roles.role IS 'officer | head | management | admin | audit (read-only mobile reports)';

-- Additive policies (coexist with role-split policies from backend_hardening)
CREATE POLICY "audit_read_inspections" ON public.inspections
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_inspection_responses" ON public.inspection_responses
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_inspection_files" ON public.inspection_files
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_general_remarks" ON public.general_remarks
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_user_roles" ON public.user_roles
  FOR SELECT USING (public.current_user_role() = 'audit');

-- Realtime: branches + inspection_responses for live audit dashboards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'branches'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inspection_responses'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_responses;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inspections'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;
    END IF;
  END IF;
END
$$;
