-- ============================================================
-- VIGILANCE MANAGEMENT SYSTEM — BRANCH LOAD FIX
-- Date: 2026-05-14
-- ============================================================
-- Addresses four bugs surfaced by the mobile officer app showing
-- "Failed to load branches. Check your connection." even when
-- the network was healthy.
--
--   Bug #1  Missing RLS policies on public.stores         (silent zero rows)
--   Bug #2  Silent PostgREST !inner join failure          (handled client-side)
--   Bug #3  branches.geofence_radius column absent        (THE root cause —
--           the mobile SELECT lists it, so the entire query 400'd)
--   Bug #4  branches_within_radius RPC missing because the postgis
--           extension was never enabled in the project
--
-- This file is the single source of truth for the fix. Safe to re-run.
-- ============================================================


-- ── 1) BUG #3 — Add geofence_radius to branches ────────────────────────────
-- The base schema (schema.sql) never defined this column. A separate
-- migration (20260506_phase1_location_gate.sql) added it, but projects
-- that bootstrapped from schema.sql alone never picked it up.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS geofence_radius integer NOT NULL DEFAULT 200;

COMMENT ON COLUMN public.branches.geofence_radius IS
  'Geofence radius in metres for the location-based check-in gate. '
  'Default 200 m. Used by the mobile officer app to decide whether '
  'the officer is close enough to the branch to start an inspection.';


-- ── 2) BUG #4 — Enable PostGIS so branches_within_radius() works ───────────
-- Supabase ships postgis 3.x as an available-but-not-installed extension.
-- The "Near Me" feature calls supabase.rpc('branches_within_radius', ...)
-- which is defined in 20260506_phase4_batch15_postgis_rpc_functions.sql,
-- but that RPC is unusable until postgis is actually CREATE EXTENSIONed.

CREATE EXTENSION IF NOT EXISTS postgis;


-- ── 3) BUG #1 — RLS on public.stores ───────────────────────────────────────
-- The compatibility patch at the bottom of schema.sql creates `stores` but
-- never enabled RLS or added policies. PostgREST returns zero rows for any
-- authenticated user when RLS is enabled (implicitly via Supabase) with no
-- matching policy. The block below is a no-op when stores doesn't exist
-- (older projects), and applies the policies when it does.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name   = 'stores'
  ) THEN
    EXECUTE 'ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "All auth users select stores" ON public.stores';
    EXECUTE $p$
      CREATE POLICY "All auth users select stores" ON public.stores
        FOR SELECT
        USING (auth.role() = 'authenticated')
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "Admin manage stores" ON public.stores';
    EXECUTE $p$
      CREATE POLICY "Admin manage stores" ON public.stores
        FOR ALL
        USING (public.current_user_role() = 'admin')
        WITH CHECK (public.current_user_role() = 'admin')
    $p$;
  END IF;
END
$$;


-- ── 4) Sanity: confirm the FK on branches → branch_types is intact ─────────
-- The mobile query uses `branch_types!inner(type_name)` which PostgREST
-- resolves through the foreign key. If the FK ever got dropped, the join
-- would 400 with "Could not find a relationship". This block reasserts it
-- only when it's missing (no-op in healthy projects).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'branches_branch_type_id_fkey'
       AND conrelid = 'public.branches'::regclass
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='branch_types'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_branch_type_id_fkey
      FOREIGN KEY (branch_type_id) REFERENCES public.branch_types(id);
  END IF;
END
$$;


-- ── 5) Sanity: any branch row with a NULL branch_type_id breaks !inner ─────
-- Surfacing as a NOTICE rather than failing the migration, because the
-- mobile app degrades gracefully when individual branches drop out.

DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
    FROM public.branches
   WHERE branch_type_id IS NULL
     AND COALESCE(deleted_at, 'epoch') = 'epoch';

  IF orphan_count > 0 THEN
    RAISE NOTICE
      '% active branch row(s) have NULL branch_type_id — these will be hidden by branch_types!inner joins',
      orphan_count;
  END IF;
END
$$;


-- ── 6) Known advisor — postgis.spatial_ref_sys lacks RLS ──────────────────
-- Enabling postgis exposes the reference table public.spatial_ref_sys
-- (EPSG SRID lookup data) which Supabase's security advisor flags as
-- "RLS Disabled in Public". The table is owned by the postgis extension
-- so a normal ALTER TABLE ... ENABLE ROW LEVEL SECURITY fails with
-- "must be owner of table spatial_ref_sys". The advisor warning is
-- harmless — the table holds public EPSG reference data only.
--
-- The best-effort fix below tries to ALTER it and silently no-ops when
-- the migration role doesn't own the table.

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read spatial_ref_sys" ON public.spatial_ref_sys';
    EXECUTE $p$
      CREATE POLICY "Public read spatial_ref_sys" ON public.spatial_ref_sys
        FOR SELECT USING (true)
    $p$;
  EXCEPTION WHEN insufficient_privilege OR insufficient_resources OR others THEN
    RAISE NOTICE
      'spatial_ref_sys is owned by the postgis extension — RLS advisor warning is expected and safe to ignore';
  END;
END
$$;


-- ============================================================
-- END OF MIGRATION
-- ============================================================
