-- ============================================================
-- PHASE 1 — Location Gate Migration
-- Adds geofence_radius to branches.
-- inspections.officer_latitude / officer_longitude already exist.
-- ============================================================

-- 1. Add geofence_radius to branches (metres, default 200)
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS geofence_radius integer NOT NULL DEFAULT 200;

COMMENT ON COLUMN public.branches.geofence_radius IS
  'Geofence radius in metres for location-based check-in gate (default 200 m)';

-- 2. Confirm officer coords exist on inspections (no-op if already present)
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS officer_latitude  numeric(10,7),
  ADD COLUMN IF NOT EXISTS officer_longitude numeric(10,7);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
