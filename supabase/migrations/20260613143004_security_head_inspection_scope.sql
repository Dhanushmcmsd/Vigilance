-- SECURITY: Scope head UPDATE on inspections to branches in assigned districts.

DROP POLICY IF EXISTS "Head update status and comment" ON public.inspections;

CREATE POLICY "head_can_update_own_district_inspections" ON public.inspections
  FOR UPDATE
  USING (
    public.current_user_role() = 'head'
    AND branch_id IN (
      SELECT b.id
      FROM public.branches b
      INNER JOIN public.district_assignments da ON da.district = b.region
      INNER JOIN public.user_roles ur ON ur.id = da.officer_id
      WHERE ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'head'
    AND branch_id IN (
      SELECT b.id
      FROM public.branches b
      INNER JOIN public.district_assignments da ON da.district = b.region
      INNER JOIN public.user_roles ur ON ur.id = da.officer_id
      WHERE ur.user_id = auth.uid()
    )
  );
