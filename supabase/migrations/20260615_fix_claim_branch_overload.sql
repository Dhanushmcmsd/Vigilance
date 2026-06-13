-- Fix ambiguous claim_branch_inspection RPC (duplicate uuid/date/time vs uuid/date/text overloads).

DROP FUNCTION IF EXISTS public.claim_branch_inspection(uuid, date, text);
DROP FUNCTION IF EXISTS public.claim_branch_inspection(uuid, date, time);
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
  v_row        public.inspections%ROWTYPE;
  v_new_id     uuid;
BEGIN
  SELECT id INTO v_officer_id
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RAISE EXCEPTION 'OFFICER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Existing draft for this officer?
  SELECT * INTO v_row
  FROM public.inspections
  WHERE branch_id = p_branch_id
    AND inspection_date = p_inspection_date
    AND status = 'draft'
    AND officer_id = v_officer_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_time_in IS NOT NULL AND v_row.time_in IS NULL THEN
      UPDATE public.inspections SET time_in = p_time_in WHERE id = v_row.id;
    END IF;
    RETURN v_row.id;
  END IF;

  -- Another officer's draft blocks access.
  IF EXISTS (
    SELECT 1 FROM public.inspections
    WHERE branch_id = p_branch_id
      AND inspection_date = p_inspection_date
      AND status = 'draft'
      AND officer_id <> v_officer_id
  ) THEN
    RAISE EXCEPTION 'BRANCH_IN_PROGRESS' USING ERRCODE = 'P0001';
  END IF;

  -- Latest submitted inspection today for this branch.
  SELECT * INTO v_row
  FROM public.inspections
  WHERE branch_id = p_branch_id
    AND inspection_date = p_inspection_date
    AND status IN ('submitted', 'approved', 'rejected')
  ORDER BY COALESCE(submitted_at, created_at) DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Edit window still active — must use reopen/delete flow, not a new claim.
    IF v_row.status = 'submitted'
       AND v_row.edit_window_expires_at IS NOT NULL
       AND v_row.edit_window_expires_at > now()
       AND v_row.officer_id = v_officer_id THEN
      RAISE EXCEPTION 'BRANCH_COMPLETED' USING ERRCODE = 'P0001';
    END IF;

    -- Edit window expired — allow a new draft (multiple reports per day).
    IF v_row.status IN ('submitted', 'approved', 'rejected')
       AND (v_row.edit_window_expires_at IS NULL OR v_row.edit_window_expires_at <= now()) THEN
      NULL;
    ELSIF v_row.status IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'BRANCH_COMPLETED' USING ERRCODE = 'P0001';
    END IF;
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

COMMENT ON FUNCTION public.claim_branch_inspection(uuid, date, time) IS
  'Creates or returns today''s draft inspection; supports edit-window and multi-report rules.';

GRANT EXECUTE ON FUNCTION public.claim_branch_inspection(uuid, date, time) TO authenticated;
