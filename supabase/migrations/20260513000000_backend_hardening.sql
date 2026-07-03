-- ============================================================
-- VIGILANCE MANAGEMENT SYSTEM — BACKEND HARDENING MIGRATION
-- Date: 2026-05-13
-- ============================================================
-- Adds:
--   * inspections.sync_status        ('pending'|'synced'|'failed') for offline tracking
--   * inspections.device_id          stable device identifier for audit
--   * inspections.app_version        client build that submitted the inspection
--   * <table>.deleted_at             soft-delete columns on:
--                                       user_roles, branches, checklist_templates
--   * notifications                  in-app alert inbox per officer/head/etc.
--   * user_roles.email               denormalised from auth.users so server-side
--                                    edge fns can address recipients without an
--                                    admin join (notify-officer falls back to
--                                    the join when this column is NULL).
--   * user_roles.expo_push_token     Expo Push token for mobile notifications
-- Tightens RLS on inspections:
--   * officer    — own rows only
--   * head       — every row
--   * management — only status='approved' rows
--   * admin      — full access (unchanged)
--
-- Naming note: the original brief called these tables `users` and
-- `checklist_items`. The deployed schema actually uses `user_roles` and
-- `checklist_templates`; the migration targets the real names so it can be
-- applied to the live database without renaming.
--
-- Safe to re-run (every DDL is guarded with IF NOT EXISTS / DO blocks).
-- ============================================================

-- ── 1) INSPECTIONS ─────────────────────────────────────────────────────────

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS device_id   text,
  ADD COLUMN IF NOT EXISTS app_version text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inspections_sync_status_check'
      AND conrelid = 'public.inspections'::regclass
  ) THEN
    ALTER TABLE public.inspections
      ADD CONSTRAINT inspections_sync_status_check
      CHECK (sync_status IN ('pending','synced','failed'));
  END IF;
END
$$;

-- Backfill any pre-existing NULLs so the new CHECK is satisfied.
UPDATE public.inspections SET sync_status = 'synced' WHERE sync_status IS NULL;

COMMENT ON COLUMN public.inspections.sync_status IS
  'pending = queued offline draft awaiting server confirmation; synced = '
  'live record; failed = flush attempted and rejected (retried by client).';
COMMENT ON COLUMN public.inspections.device_id IS
  'Opaque, app-generated stable identifier for the submitting device. NOT '
  'the OS IMEI/UUID — we never read those. See mobile/lib/deviceInfo.ts.';
COMMENT ON COLUMN public.inspections.app_version IS
  'Native application version (e.g. "1.4.2") at the moment the inspection '
  'was submitted. Useful for triaging bugs that only affect old builds.';

-- Partial index — only failed/pending rows matter for the sync dashboard,
-- everything else is the steady state.
CREATE INDEX IF NOT EXISTS idx_inspections_sync_status
  ON public.inspections (sync_status, submitted_at DESC)
  WHERE sync_status <> 'synced';

CREATE INDEX IF NOT EXISTS idx_inspections_device_id
  ON public.inspections (device_id)
  WHERE device_id IS NOT NULL;

-- ── 2) SOFT DELETE ─────────────────────────────────────────────────────────

ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.branches             ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.checklist_templates  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.user_roles.deleted_at          IS 'Soft-delete marker — set instead of hard DELETE so historical inspection rows still link to a real officer name.';
COMMENT ON COLUMN public.branches.deleted_at            IS 'Soft-delete marker. Branches with deleted_at IS NOT NULL are hidden from officer pickers but stay queryable from the audit views.';
COMMENT ON COLUMN public.checklist_templates.deleted_at IS 'Soft-delete marker. Lets us retire a question without losing past inspection_responses that reference it.';

-- Partial indexes — soft-deleted rows are the rare case.
CREATE INDEX IF NOT EXISTS idx_user_roles_deleted_at
  ON public.user_roles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branches_deleted_at
  ON public.branches (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_templates_deleted_at
  ON public.checklist_templates (deleted_at) WHERE deleted_at IS NOT NULL;

-- Tighten existing "active" RLS to also exclude soft-deleted rows. Existing
-- policies were created with USING (is_active = true) — we extend them.
DROP POLICY IF EXISTS "All auth users select active branches" ON public.branches;
CREATE POLICY "All auth users select active branches" ON public.branches
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND is_active = true
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "All auth users select active checklist items" ON public.checklist_templates;
CREATE POLICY "All auth users select active checklist items" ON public.checklist_templates
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND is_active = true
    AND deleted_at IS NULL
  );

-- ── 3) user_roles: email + expo_push_token ─────────────────────────────────

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS expo_push_token text;

COMMENT ON COLUMN public.user_roles.email IS
  'Denormalised from auth.users.email for fast lookup by edge functions. '
  'May lag behind auth.users — server-side fallback path always joins '
  'auth.users when this column is NULL.';
COMMENT ON COLUMN public.user_roles.expo_push_token IS
  'ExponentPushToken[...] string registered by the mobile app. Used by '
  'the notify-officer edge function.';

CREATE INDEX IF NOT EXISTS idx_user_roles_email
  ON public.user_roles (email) WHERE email IS NOT NULL;

-- ── 4) NOTIFICATIONS TABLE ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   uuid        NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  inspection_id  uuid        REFERENCES public.inspections(id) ON DELETE CASCADE,
  type           text        NOT NULL,
  title          text        NOT NULL,
  body           text,
  link           text,
  is_read        boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  read_at        timestamptz
);

COMMENT ON TABLE public.notifications IS
  'In-app inbox. One row per delivered alert. The `type` column is a free '
  'tag (e.g. inspection_approved, inspection_rejected, clarification_requested, '
  'red_alert, weekly_summary). The mobile app subscribes to this table via '
  'Supabase Realtime to render the bell-icon badge.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_not_empty'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_not_empty CHECK (length(type) > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_inspection
  ON public.notifications (inspection_id)
  WHERE inspection_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read & mark their own notifications read.
DROP POLICY IF EXISTS "Recipient reads own notifications" ON public.notifications;
CREATE POLICY "Recipient reads own notifications" ON public.notifications
  FOR SELECT USING (recipient_id = public.current_user_roles_id());

DROP POLICY IF EXISTS "Recipient updates own notifications" ON public.notifications;
CREATE POLICY "Recipient updates own notifications" ON public.notifications
  FOR UPDATE USING (recipient_id = public.current_user_roles_id())
  WITH CHECK (recipient_id = public.current_user_roles_id());

-- Insert path is restricted to head/admin from the client; edge functions
-- run with the service role and bypass RLS, so they can always insert.
DROP POLICY IF EXISTS "Head/admin insert notifications" ON public.notifications;
CREATE POLICY "Head/admin insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('head','admin')
  );

DROP POLICY IF EXISTS "Admin manage notifications" ON public.notifications;
CREATE POLICY "Admin manage notifications" ON public.notifications
  FOR ALL USING (public.current_user_role() = 'admin');

-- Add the table to the realtime publication so the mobile app can subscribe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

-- ── 5) RLS — inspections SELECT (role-aware) ───────────────────────────────
-- The base schema has a single permissive policy that lets head/management/
-- admin see every row. The new rules require management to see ONLY approved
-- inspections, so we replace that policy with three explicit ones (admin keeps
-- its existing "Admin full access to inspections" policy which we don't touch).

DROP POLICY IF EXISTS "Officers select own inspections" ON public.inspections;

DROP POLICY IF EXISTS "officer_own_inspections"        ON public.inspections;
DROP POLICY IF EXISTS "head_all_inspections"           ON public.inspections;
DROP POLICY IF EXISTS "management_approved_inspections" ON public.inspections;

CREATE POLICY "officer_own_inspections" ON public.inspections
  FOR SELECT USING (
    officer_id = public.current_user_roles_id()
  );

CREATE POLICY "head_all_inspections" ON public.inspections
  FOR SELECT USING (
    public.current_user_role() = 'head'
  );

CREATE POLICY "management_approved_inspections" ON public.inspections
  FOR SELECT USING (
    public.current_user_role() = 'management'
    AND status = 'approved'
  );

-- Sanity: the "Admin full access to inspections" policy created in schema.sql
-- already grants admin SELECT/INSERT/UPDATE/DELETE via FOR ALL. We do NOT
-- touch it here.

-- ============================================================
-- END OF MIGRATION
-- ============================================================
