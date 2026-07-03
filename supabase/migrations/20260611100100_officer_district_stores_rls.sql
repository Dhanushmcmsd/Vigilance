CREATE OR REPLACE FUNCTION public.officer_districts(uid uuid)
RETURNS text[] LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(district), ARRAY[]::text[])
  FROM public.district_assignments
  WHERE officer_id = (SELECT id FROM public.user_roles WHERE user_id = uid LIMIT 1);
$$;

REVOKE EXECUTE ON FUNCTION public.officer_districts(uuid) FROM anon;

DROP POLICY IF EXISTS "All auth users select stores" ON public.stores;
DROP POLICY IF EXISTS "officer_read_own_district_stores" ON public.stores;

CREATE POLICY "officer_read_own_district_stores" ON public.stores
  FOR SELECT TO authenticated
  USING (
    region = ANY(public.officer_districts(auth.uid()))
    OR
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
      IN ('admin','head','management','audit')
  );

DROP POLICY IF EXISTS "Admin manage stores" ON public.stores;
CREATE POLICY "Admin manage stores" ON public.stores
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin')
  WITH CHECK ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin');
