-- Management dashboard must show field submissions before head approval.
-- fetchManagementInspections() filters status IN (submitted, approved, rejected);
-- the prior policy (approved-only) hid new officer visits from the live dashboard.

DROP POLICY IF EXISTS "management_approved_inspections" ON public.inspections;

CREATE POLICY "management_submitted_inspections" ON public.inspections
  FOR SELECT USING (
    public.current_user_role() = 'management'
    AND status IN ('submitted', 'approved', 'rejected')
  );

COMMENT ON POLICY "management_submitted_inspections" ON public.inspections IS
  'Management live dashboard: all finalized field visits (not draft).';
