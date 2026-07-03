-- SECURITY: Add caller identity checks to PostGIS SECURITY DEFINER RPCs.

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
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('management', 'admin', 'officer')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
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
END;
$$;


CREATE OR REPLACE FUNCTION public.was_officer_in_range(
  inspection_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_officer_geom   geometry;
  v_branch_geom    geometry;
  v_geofence_radius integer := 200;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.inspections i
    JOIN public.user_roles ur ON ur.id = i.officer_id
    WHERE i.id = was_officer_in_range.inspection_id
      AND (
        ur.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('management', 'admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    i.officer_geom,
    b.geom
  INTO v_officer_geom, v_branch_geom
  FROM public.inspections i
  JOIN public.branches b ON b.id = i.branch_id
  WHERE i.id = was_officer_in_range.inspection_id
  LIMIT 1;

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


-- inspection_ping_trail: only hardened when inspection_location_pings exists on this project.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inspection_location_pings'
  ) THEN
    EXECUTE $sql$
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
      SET search_path = public
      AS $fn$
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
          AND (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid()
                AND role IN ('management', 'admin')
            )
            OR EXISTS (
              SELECT 1
              FROM public.inspections insp
              JOIN public.user_roles ur ON ur.id = insp.officer_id
              WHERE insp.id = p_inspection_id
                AND ur.user_id = auth.uid()
            )
          )
        ORDER BY p.recorded_at ASC;
      $fn$;
    $sql$;
  END IF;
END $$;
