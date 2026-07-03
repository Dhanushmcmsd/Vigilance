-- Officers could SELECT/UPDATE their draft rows, but PostgreSQL applies USING as
-- WITH CHECK when with_check is omitted. That blocked status draft → submitted
-- (new row failed check status = 'draft'), so mobile submit updated 0 rows silently.

DROP POLICY IF EXISTS "Officers update own draft inspections" ON public.inspections;

CREATE POLICY "Officers update own draft inspections" ON public.inspections
  FOR UPDATE
  USING (
    officer_id = public.current_user_roles_id()
    AND status = 'draft'
  )
  WITH CHECK (
    officer_id = public.current_user_roles_id()
    AND status IN ('draft', 'submitted')
  );

COMMENT ON POLICY "Officers update own draft inspections" ON public.inspections IS
  'Officer may edit own draft; may set status to submitted on submit (WITH CHECK allows submitted).';
