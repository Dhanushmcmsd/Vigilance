-- 1-hour edit window after submission + allow multiple reports per branch/day
-- after the edit window expires.

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS edit_window_expires_at timestamptz;

COMMENT ON COLUMN public.inspections.edit_window_expires_at IS
  'Officers may edit a submitted report until this timestamp (1 hour after submit).';

-- Backfill existing submitted rows so they remain editable for 1 hour from submit time.
UPDATE public.inspections
SET edit_window_expires_at = submitted_at + interval '1 hour'
WHERE status IN ('submitted', 'approved', 'rejected')
  AND submitted_at IS NOT NULL
  AND edit_window_expires_at IS NULL;

-- Allow multiple submitted inspections per branch per day (new visit after edit window).
DROP INDEX IF EXISTS public.idx_inspections_one_final_per_branch_day;

-- Reopen a submitted inspection for editing within the 1-hour window (keeps responses).
CREATE OR REPLACE FUNCTION public.reopen_inspection_for_edit(p_inspection_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer_id            uuid;
  v_inspection_officer_id uuid;
  v_status                text;
  v_expires               timestamptz;
BEGIN
  SELECT id INTO v_officer_id
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RAISE EXCEPTION 'OFFICER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT officer_id, status, edit_window_expires_at
    INTO v_inspection_officer_id, v_status, v_expires
  FROM public.inspections
  WHERE id = p_inspection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inspection_officer_id <> v_officer_id THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('submitted') THEN
    RAISE EXCEPTION 'NOT_EDITABLE' USING ERRCODE = 'P0001';
  END IF;

  IF v_expires IS NULL OR v_expires <= now() THEN
    RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspections
  SET status = 'draft',
      sync_status = 'synced'
  WHERE id = p_inspection_id;

  RETURN p_inspection_id;
END;
$$;

COMMENT ON FUNCTION public.reopen_inspection_for_edit IS
  'Reopens a submitted inspection within the 1-hour edit window without deleting responses.';

GRANT EXECUTE ON FUNCTION public.reopen_inspection_for_edit(uuid) TO authenticated;

-- Update delete_and_reset to only work within edit window.
CREATE OR REPLACE FUNCTION public.delete_and_reset_inspection(p_inspection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer_id            uuid;
  v_inspection_officer_id uuid;
  v_status                text;
  v_expires               timestamptz;
BEGIN
  SELECT id INTO v_officer_id
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RAISE EXCEPTION 'OFFICER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT officer_id, status, edit_window_expires_at
    INTO v_inspection_officer_id, v_status, v_expires
  FROM public.inspections
  WHERE id = p_inspection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inspection_officer_id <> v_officer_id THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('submitted', 'draft') THEN
    RAISE EXCEPTION 'CANNOT_REFILL_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'submitted' AND (v_expires IS NULL OR v_expires <= now()) THEN
    RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.inspection_responses WHERE inspection_id = p_inspection_id;
  DELETE FROM public.inspection_files     WHERE inspection_id = p_inspection_id;
  DELETE FROM public.general_remarks      WHERE inspection_id = p_inspection_id;
  DELETE FROM public.inspections          WHERE id = p_inspection_id;
END;
$$;

-- Claim: allow new draft when latest submitted inspection edit window has expired.
CREATE OR REPLACE FUNCTION public.claim_branch_inspection(
  p_branch_id uuid,
  p_inspection_date date DEFAULT CURRENT_DATE,
  p_time_in text DEFAULT NULL
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
    IF p_time_in IS NOT NULL THEN
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
      -- fall through to insert new draft
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

-- Branch locks: include edit-window metadata; prefer draft over submitted.
DROP FUNCTION IF EXISTS public.get_today_branch_locks(uuid);

CREATE OR REPLACE FUNCTION public.get_today_branch_locks(p_branch_type_id uuid)
RETURNS TABLE (
  branch_id uuid,
  status text,
  officer_id uuid,
  officer_name text,
  inspection_id uuid,
  submitted_at timestamptz,
  edit_window_expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      i.branch_id,
      i.status,
      i.officer_id,
      ur.name AS officer_name,
      i.id AS inspection_id,
      i.submitted_at,
      i.edit_window_expires_at,
      ROW_NUMBER() OVER (
        PARTITION BY i.branch_id
        ORDER BY
          CASE WHEN i.status = 'draft' THEN 0 ELSE 1 END,
          COALESCE(i.submitted_at, i.created_at) DESC
      ) AS rn
    FROM public.inspections i
    INNER JOIN public.branches b ON b.id = i.branch_id
    INNER JOIN public.user_roles ur ON ur.id = i.officer_id
    WHERE b.branch_type_id = p_branch_type_id
      AND b.is_active = true
      AND i.inspection_date = CURRENT_DATE
      AND i.status IN ('draft', 'submitted', 'approved', 'rejected')
  )
  SELECT
    branch_id,
    status,
    officer_id,
    officer_name,
    inspection_id,
    submitted_at,
    edit_window_expires_at
  FROM ranked
  WHERE rn = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_branch_locks(uuid) TO authenticated;
