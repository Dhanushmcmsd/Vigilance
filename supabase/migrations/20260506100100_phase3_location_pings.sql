-- ============================================================
-- PHASE 3 — Periodic Location Pings Migration
-- Creates inspection_location_pings table.
-- Purely additive — no existing tables or policies are altered.
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.inspection_location_pings (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid           NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  latitude       numeric(10,7)  NOT NULL,
  longitude      numeric(10,7)  NOT NULL,
  accuracy       numeric(6,2),
  recorded_at    timestamptz    DEFAULT now()
);

COMMENT ON TABLE public.inspection_location_pings IS
  'Periodic GPS pings captured while an officer is actively completing a checklist, used to verify on-site presence throughout the inspection.';

COMMENT ON COLUMN public.inspection_location_pings.accuracy IS
  'GPS accuracy in metres as reported by the device.';

-- 2. Index on inspection_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_location_pings_inspection_id
  ON public.inspection_location_pings(inspection_id);

-- 3. Enable RLS
ALTER TABLE public.inspection_location_pings ENABLE ROW LEVEL SECURITY;

-- 4. Officers can INSERT pings only for their own active (non-submitted) inspections
CREATE POLICY "Officers insert own location pings"
  ON public.inspection_location_pings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
        AND i.status = 'draft'
    )
  );

-- 5. Head, management and admin can SELECT all pings
--    Officers cannot read any pings (their own or others').
CREATE POLICY "Supervisors select location pings"
  ON public.inspection_location_pings
  FOR SELECT
  USING (
    public.current_user_role() IN ('head', 'management', 'admin')
  );

-- 6. Admin has full access (delete stale pings, etc.)
CREATE POLICY "Admin full access to location pings"
  ON public.inspection_location_pings
  FOR ALL
  USING (public.current_user_role() = 'admin');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
