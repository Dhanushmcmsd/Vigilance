-- SECURITY: Prevent UUID enumeration via officer_districts(uid).

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
