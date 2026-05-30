-- ============================================================
-- VIGILANCE — REFILL INSPECTION MIGRATION
-- Allows the original submitting officer to delete a completed
-- inspection and all its data, then start fresh for that branch/day.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_and_reset_inspection(
  p_inspection_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer_id            uuid;
  v_inspection_officer_id uuid;
  v_status                text;
BEGIN
  -- Resolve current officer
  SELECT id INTO v_officer_id
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RAISE EXCEPTION 'OFFICER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Fetch inspection owner + status
  SELECT officer_id, status
    INTO v_inspection_officer_id, v_status
  FROM public.inspections
  WHERE id = p_inspection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Only the officer who submitted can refill
  IF v_inspection_officer_id <> v_officer_id THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;

  -- Only allow refill of submitted inspections (not approved/rejected)
  IF v_status NOT IN ('submitted', 'draft') THEN
    RAISE EXCEPTION 'CANNOT_REFILL_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  -- Delete all related data (cascade order matters)
  DELETE FROM public.inspection_responses WHERE inspection_id = p_inspection_id;
  DELETE FROM public.inspection_files     WHERE inspection_id = p_inspection_id;
  DELETE FROM public.general_remarks      WHERE inspection_id = p_inspection_id;
  DELETE FROM public.inspections          WHERE id = p_inspection_id;
END;
$$;

COMMENT ON FUNCTION public.delete_and_reset_inspection IS
  'Allows the original submitting officer to permanently delete a submitted inspection and all its data, so they can refill the checklist for the same branch/day.';

GRANT EXECUTE ON FUNCTION public.delete_and_reset_inspection(uuid) TO authenticated;
