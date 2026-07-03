-- Restrict get_today_branch_locks so officers only see their own locks.

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
    AND i.status IN ('draft', 'submitted', 'approved', 'rejected')
    AND (
      COALESCE(auth.jwt() ->> 'role', '') IN ('admin', 'head', 'executive')
      OR i.officer_id = (SELECT id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
    );
$$;

COMMENT ON FUNCTION public.get_today_branch_locks IS
  'Returns today''s branch-level inspection locks; officers see only their own rows.';

GRANT EXECUTE ON FUNCTION public.get_today_branch_locks(uuid) TO authenticated;
