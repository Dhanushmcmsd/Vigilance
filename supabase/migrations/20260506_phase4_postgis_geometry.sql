-- ============================================================
-- Phase 4 | Batch 14 — Enable PostGIS & Add Geometry Columns
-- Idempotent: safe to run multiple times
-- Does NOT remove or alter existing lat/lon columns
-- ============================================================

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add geom column to branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 3. Add officer_geom column to inspections
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS officer_geom geometry(Point, 4326);

-- 4. Backfill branches.geom from existing lat/lon values
UPDATE public.branches
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- 5. Backfill inspections.officer_geom from existing officer lat/lon values
UPDATE public.inspections
SET officer_geom = ST_SetSRID(
  ST_MakePoint(officer_longitude, officer_latitude), 4326)
WHERE officer_latitude IS NOT NULL
  AND officer_longitude IS NOT NULL;

-- 6. Trigger function: keep branches.geom in sync with latitude/longitude
CREATE OR REPLACE FUNCTION public.sync_branch_geom()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_branch_geom ON public.branches;
CREATE TRIGGER trg_sync_branch_geom
BEFORE INSERT OR UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.sync_branch_geom();

-- 7. Trigger function: keep inspections.officer_geom in sync with officer lat/lon
CREATE OR REPLACE FUNCTION public.sync_inspection_officer_geom()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.officer_latitude IS NOT NULL AND NEW.officer_longitude IS NOT NULL THEN
    NEW.officer_geom := ST_SetSRID(
      ST_MakePoint(NEW.officer_longitude, NEW.officer_latitude), 4326);
  ELSE
    NEW.officer_geom := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspection_officer_geom ON public.inspections;
CREATE TRIGGER trg_sync_inspection_officer_geom
BEFORE INSERT OR UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.sync_inspection_officer_geom();

-- 8. Spatial index on branches.geom
CREATE INDEX IF NOT EXISTS idx_branches_geom
  ON public.branches USING GIST(geom);

-- 9. Spatial index on inspections.officer_geom
CREATE INDEX IF NOT EXISTS idx_inspections_officer_geom
  ON public.inspections USING GIST(officer_geom);
