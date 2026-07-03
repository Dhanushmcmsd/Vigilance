-- Accept officer arrival time during draft claim and persist it as time_in.
-- This prevents fallback logic from using created_at (draft creation time).

DROP FUNCTION IF EXISTS public.claim_branch_inspection(uuid, date);

CREATE OR REPLACE FUNCTION public.claim_branch_inspection(
  p_branch_id uuid,
  p_inspection_date date DEFAULT CURRENT_DATE,
  p_time_in time DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer_id uuid;
  v_row public.inspections%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT id INTO v_officer_id
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RAISE EXCEPTION 'OFFICER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.inspections
  WHERE branch_id = p_branch_id
    AND inspection_date = p_inspection_date
    AND status IN ('draft', 'submitted', 'approved', 'rejected')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.status IN ('submitted', 'approved', 'rejected') THEN
      RAISE EXCEPTION 'BRANCH_COMPLETED' USING ERRCODE = 'P0001';
    END IF;
    IF v_row.officer_id <> v_officer_id THEN
      RAISE EXCEPTION 'BRANCH_IN_PROGRESS' USING ERRCODE = 'P0001';
    END IF;
    IF v_row.time_in IS NULL AND p_time_in IS NOT NULL THEN
      UPDATE public.inspections
      SET time_in = p_time_in
      WHERE id = v_row.id;
    END IF;
    RETURN v_row.id;
  END IF;

  INSERT INTO public.inspections (
    officer_id,
    branch_id,
    inspection_date,
    status,
    sync_status,
    time_in
  ) VALUES (
    v_officer_id,
    p_branch_id,
    p_inspection_date,
    'draft',
    'synced',
    p_time_in
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.claim_branch_inspection IS
  'Creates or returns today''s draft inspection and writes officer arrival time_in during claim.';

GRANT EXECUTE ON FUNCTION public.claim_branch_inspection(uuid, date, time) TO authenticated;

-- Backfill existing draft rows that have no time_in yet.
UPDATE public.inspections
SET time_in = COALESCE(time_in, created_at::time)
WHERE status = 'draft'
  AND time_in IS NULL;
