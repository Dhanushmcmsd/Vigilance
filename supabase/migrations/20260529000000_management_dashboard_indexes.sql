-- Performance indexes for management / CEO dashboard inspection queries.
-- Safe to run multiple times (IF NOT EXISTS).

-- Primary filter: status + recent inspection_date ordering
CREATE INDEX IF NOT EXISTS idx_inspections_status_inspection_date
  ON public.inspections (status, inspection_date DESC)
  WHERE status IN ('submitted', 'approved', 'rejected');

-- Officer / branch joins used in nested selects
CREATE INDEX IF NOT EXISTS idx_inspections_branch_id
  ON public.inspections (branch_id);

CREATE INDEX IF NOT EXISTS idx_inspection_responses_inspection_id
  ON public.inspection_responses (inspection_id);

-- Role lookup for auth bootstrap (get_my_user_role fallback)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active
  ON public.user_roles (user_id, created_at DESC)
  WHERE is_active = true AND deleted_at IS NULL;

COMMENT ON INDEX idx_inspections_status_inspection_date IS
  'Supports management dashboard listing: filter by status, sort by inspection_date.';
