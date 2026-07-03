-- ============================================================
-- Phase 4 | Batch 15 — PostGIS Utility RPC Functions
-- For FUTURE USE only — not yet called by the app
-- All functions use SECURITY DEFINER
-- ============================================================


-- ============================================================
-- FUNCTION 1: branches_within_radius
-- Returns all branches within X metres of a given GPS coordinate
-- Usage: SELECT * FROM branches_within_radius(10.5276, 76.2144, 5000);
-- ============================================================
CREATE OR REPLACE FUNCTION public.branches_within_radius(
  lat            numeric,
  lon            numeric,
  radius_metres  integer
)
RETURNS TABLE (
  id               uuid,
  branch_name      text,
  city             text,
  location         text,
  distance_metres  numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    b.id,
    b.branch_name,
    b.city,
    b.location,
    ROUND(
      ST_Distance(
        b.geom::geography,
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
      )::numeric,
      2
    ) AS distance_metres
  FROM public.branches b
  WHERE
    b.geom IS NOT NULL
    AND ST_DWithin(
          b.geom::geography,
          ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
          radius_metres
        )
  ORDER BY distance_metres ASC;
$$;


-- ============================================================
-- FUNCTION 2: was_officer_in_range
-- Returns TRUE if the officer was within the branch geofence
-- radius during a given inspection (uses officer_geom vs branch geom)
-- Usage: SELECT was_officer_in_range('<inspection_uuid>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.was_officer_in_range(
  inspection_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_officer_geom   geometry;
  v_branch_geom    geometry;
  v_geofence_radius integer := 200;  -- default 200 metres; adjust as needed
BEGIN
  -- Fetch officer geom and the associated branch geom for the inspection
  SELECT
    i.officer_geom,
    b.geom
  INTO v_officer_geom, v_branch_geom
  FROM public.inspections i
  JOIN public.branches b ON b.id = i.branch_id
  WHERE i.id = inspection_id
  LIMIT 1;

  -- Return NULL (indeterminate) if either geometry is missing
  IF v_officer_geom IS NULL OR v_branch_geom IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ST_DWithin(
    v_officer_geom::geography,
    v_branch_geom::geography,
    v_geofence_radius
  );
END;
$$;


-- ============================================================
-- FUNCTION 3: inspection_ping_trail
-- Returns all location pings for an inspection in chronological
-- order, with the distance from the branch geom at each ping.
-- Usage: SELECT * FROM inspection_ping_trail('<inspection_uuid>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.inspection_ping_trail(
  p_inspection_id uuid
)
RETURNS TABLE (
  recorded_at                  timestamptz,
  latitude                     numeric,
  longitude                    numeric,
  distance_from_branch_metres  numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.recorded_at,
    p.latitude,
    p.longitude,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        b.geom::geography
      )::numeric,
      2
    ) AS distance_from_branch_metres
  FROM public.inspection_location_pings p
  JOIN public.inspections i  ON i.id  = p.inspection_id
  JOIN public.branches     b  ON b.id  = i.branch_id
  WHERE
    p.inspection_id = p_inspection_id
    AND b.geom IS NOT NULL
  ORDER BY p.recorded_at ASC;
$$;
