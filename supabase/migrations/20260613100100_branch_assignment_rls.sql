-- Officers see home-district branches unless reassigned to someone else; plus stores explicitly assigned to them.

DROP POLICY IF EXISTS "district_scoped_branch_select" ON public.branches;

CREATE POLICY "district_scoped_branch_select" ON public.branches
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
      IN ('admin', 'head', 'management', 'audit')
    OR assigned_officer_id = auth.uid()
    OR (
      assigned_officer_id IS NULL
      AND region = ANY(public.officer_districts(auth.uid()))
    )
  );
