-- Stores server-verified geofence result per inspection.
-- Populated by on-inspection-submit edge function after PostGIS check.
-- NULL means legacy submission before this feature was added.
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS location_status TEXT
  CHECK (location_status IN ('inside', 'outside', 'unverified'))
  DEFAULT NULL;

COMMENT ON COLUMN public.inspections.location_status IS
  'Server-verified geofence result: inside = officer was within
   branch radius at submission time. outside = GPS outside radius.
   unverified = GPS data missing or PostGIS check failed.';

CREATE INDEX IF NOT EXISTS idx_inspections_location_status
  ON public.inspections(location_status);

-- Internal-only RPC for the submission webhook (service role).
-- Uses officer_geom + branch geom + branches.geofence_radius.
CREATE OR REPLACE FUNCTION public.compute_inspection_location_status(
  p_inspection_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_officer_geom    geometry;
  v_branch_geom     geometry;
  v_geofence_radius integer;
  v_in_range        boolean;
BEGIN
  SELECT
    i.officer_geom,
    b.geom,
    COALESCE(b.geofence_radius, 200)
  INTO v_officer_geom, v_branch_geom, v_geofence_radius
  FROM public.inspections i
  JOIN public.branches b ON b.id = i.branch_id
  WHERE i.id = p_inspection_id
  LIMIT 1;

  IF NOT FOUND OR v_officer_geom IS NULL OR v_branch_geom IS NULL THEN
    RETURN 'unverified';
  END IF;

  v_in_range := ST_DWithin(
    v_officer_geom::geography,
    v_branch_geom::geography,
    v_geofence_radius
  );

  IF v_in_range THEN
    RETURN 'inside';
  END IF;

  RETURN 'outside';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'unverified';
END;
$$;

REVOKE ALL ON FUNCTION public.compute_inspection_location_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_inspection_location_status(uuid) TO service_role;
