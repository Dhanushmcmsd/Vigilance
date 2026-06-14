-- District-scope branch visibility for officers (mirrors stores RLS pattern).

DROP POLICY IF EXISTS "All auth users select active branches" ON public.branches;

CREATE POLICY "district_scoped_branch_select" ON public.branches
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
      IN ('admin', 'head', 'management', 'audit')
    OR region = ANY(public.officer_districts(auth.uid()))
  );
