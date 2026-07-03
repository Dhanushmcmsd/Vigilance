-- One inspection per branch per calendar day; officers see locks via RPC (no cross-officer RLS leak).

-- Remove duplicate rows before unique indexes (keep newest per branch/day).
WITH draft_dupes AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY branch_id, inspection_date
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.inspections
  WHERE status = 'draft'
)
DELETE FROM public.inspections
WHERE id IN (SELECT id FROM draft_dupes WHERE rn > 1);

WITH final_dupes AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY branch_id, inspection_date
      ORDER BY COALESCE(submitted_at, updated_at, created_at) DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.inspections
  WHERE status IN ('submitted', 'approved', 'rejected')
)
DELETE FROM public.inspections
WHERE id IN (SELECT id FROM final_dupes WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inspections_one_draft_per_branch_day
  ON public.inspections (branch_id, inspection_date)
  WHERE status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS idx_inspections_one_final_per_branch_day
  ON public.inspections (branch_id, inspection_date)
  WHERE status IN ('submitted', 'approved', 'rejected');

CREATE OR REPLACE FUNCTION public.get_today_branch_locks(p_branch_type_id uuid)
RETURNS TABLE (
  branch_id uuid,
  status text,
  officer_id uuid,
  officer_name text,
  inspection_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    i.branch_id,
    i.status,
    i.officer_id,
    ur.name AS officer_name,
    i.id AS inspection_id
  FROM public.inspections i
  INNER JOIN public.branches b ON b.id = i.branch_id
  INNER JOIN public.user_roles ur ON ur.id = i.officer_id
  WHERE b.branch_type_id = p_branch_type_id
    AND b.is_active = true
    AND i.inspection_date = CURRENT_DATE
    AND i.status IN ('draft', 'submitted', 'approved', 'rejected');
$$;

COMMENT ON FUNCTION public.get_today_branch_locks IS
  'Returns today''s branch-level inspection locks for officers (draft or completed).';

GRANT EXECUTE ON FUNCTION public.get_today_branch_locks(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_branch_inspection(
  p_branch_id uuid,
  p_inspection_date date DEFAULT CURRENT_DATE
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
    RETURN v_row.id;
  END IF;

  INSERT INTO public.inspections (
    officer_id,
    branch_id,
    inspection_date,
    status,
    sync_status
  ) VALUES (
    v_officer_id,
    p_branch_id,
    p_inspection_date,
    'draft',
    'synced'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.claim_branch_inspection IS
  'Creates or returns today''s draft inspection for the current officer; blocks other officers on the same branch/day.';

GRANT EXECUTE ON FUNCTION public.claim_branch_inspection(uuid, date) TO authenticated;
