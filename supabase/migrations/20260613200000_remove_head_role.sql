-- Remove the head role from the application entirely.
-- Migrates any existing head accounts to management and drops head-only policies.

UPDATE public.user_roles
SET role = 'management'
WHERE role = 'head';

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('officer', 'management', 'admin', 'audit'));

DROP POLICY IF EXISTS "Head update status and comment" ON public.inspections;
DROP POLICY IF EXISTS "head_can_update_own_district_inspections" ON public.inspections;

-- Re-harden officer_districts without head in elevated roles.
CREATE OR REPLACE FUNCTION public.officer_districts(uid uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF uid <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('management', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: cannot query another user''s districts';
  END IF;

  RETURN (
    SELECT COALESCE(ARRAY_AGG(district), ARRAY[]::text[])
    FROM public.district_assignments
    WHERE officer_id = (
      SELECT id FROM public.user_roles WHERE user_id = uid LIMIT 1
    )
  );
END;
$$;

-- Re-harden branches_within_radius without head role.
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

-- Re-harden was_officer_in_range without head in elevated roles.
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
