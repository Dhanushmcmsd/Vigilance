-- ============================================================
-- VIGILANCE MANAGEMENT SYSTEM — SUPABASE SCHEMA
-- Phase 1: Complete Database Setup
-- Paste this into Supabase SQL Editor and Run
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- 1. user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('officer','head','management','admin','audit')),
  name        text        NOT NULL,
  phone       text,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. branch_types
CREATE TABLE IF NOT EXISTS public.branch_types (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name   text  UNIQUE NOT NULL
);

-- 3. branches
CREATE TABLE IF NOT EXISTS public.branches (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_type_id   uuid          REFERENCES public.branch_types(id),
  branch_name      text          NOT NULL,
  location         text,
  city             text,
  region           text,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  geofence_radius  integer       NOT NULL DEFAULT 200,
  is_active        boolean       DEFAULT true,
  created_at       timestamptz   DEFAULT now()
);
-- Idempotent guard for projects that pre-date the geofence_radius column.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS geofence_radius integer NOT NULL DEFAULT 200;

-- 4. checklist_templates
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_type_id   uuid  REFERENCES public.branch_types(id),  -- NULL = all types
  section          text  NOT NULL,
  item_text        text  NOT NULL,
  item_order       int   NOT NULL,
  is_active        boolean     DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- 5. inspections
CREATE TABLE IF NOT EXISTS public.inspections (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id          uuid          REFERENCES public.user_roles(id),
  branch_id           uuid          REFERENCES public.branches(id),
  inspection_date     date          NOT NULL,
  time_in             time,
  time_out            time,
  status              text          DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  compliance_score    numeric(5,2),
  risk_level          text          CHECK (risk_level IN ('low','medium','high','critical')),
  head_comment        text,
  officer_latitude    numeric(10,7),
  officer_longitude   numeric(10,7),
  device_info         text,
  sync_status         text          DEFAULT 'synced' CHECK (sync_status IN ('pending','synced','failed')),
  device_id           text,
  app_version         text,
  created_at          timestamptz   DEFAULT now(),
  updated_at          timestamptz   DEFAULT now(),
  submitted_at        timestamptz
);

-- 6. inspection_responses
CREATE TABLE IF NOT EXISTS public.inspection_responses (
  id                 uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id      uuid  REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id  uuid  REFERENCES public.checklist_templates(id),
  response           text  CHECK (response IN ('Yes','No','N/A')),
  remarks            text,
  created_at         timestamptz DEFAULT now()
);

-- 7. inspection_files
CREATE TABLE IF NOT EXISTS public.inspection_files (
  id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id       uuid  REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id   uuid  REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  file_url            text  NOT NULL,
  file_name           text,
  file_type           text,   -- 'image' or 'document'
  uploaded_at         timestamptz DEFAULT now()
);

-- 8. general_remarks
CREATE TABLE IF NOT EXISTS public.general_remarks (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid  REFERENCES public.inspections(id) ON DELETE CASCADE,
  remark_text    text,
  created_at     timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inspections_officer_id   ON public.inspections(officer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_branch_id    ON public.inspections(branch_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status       ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_date         ON public.inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_responses_inspection_id  ON public.inspection_responses(inspection_id);
CREATE INDEX IF NOT EXISTS idx_branches_type_id         ON public.branches(branch_type_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- COMPLIANCE SCORE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_response_compliant(
  p_response text,
  p_trigger_on_no boolean
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_response IS NULL OR p_response = 'N/A' THEN NULL
    WHEN p_trigger_on_no THEN p_response = 'Yes'
    ELSE p_response = 'No'
  END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_compliance_score()
RETURNS TRIGGER AS $$
DECLARE
  v_compliant_count int;
  v_total_count     int;
  v_score           numeric(5,2);
  v_risk            text;
BEGIN
  SELECT
    COUNT(*) FILTER (
      WHERE public.is_response_compliant(
        ir.response,
        COALESCE(rc.trigger_on_no, ct.trigger_on_no, true)
      ) IS TRUE
    ),
    COUNT(*) FILTER (WHERE ir.response IN ('Yes', 'No'))
  INTO v_compliant_count, v_total_count
  FROM public.inspection_responses ir
  JOIN public.checklist_templates ct ON ct.id = ir.checklist_item_id
  LEFT JOIN public.risk_classifications rc ON rc.checklist_item_id = ct.id
  WHERE ir.inspection_id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  IF v_total_count > 0 THEN
    v_score := (v_compliant_count::numeric / v_total_count::numeric) * 100;
  ELSE
    v_score := NULL;
  END IF;

  IF v_score IS NULL THEN
    v_risk := NULL;
  ELSIF v_score >= 80 THEN
    v_risk := 'low';
  ELSIF v_score >= 60 THEN
    v_risk := 'medium';
  ELSIF v_score >= 40 THEN
    v_risk := 'high';
  ELSE
    v_risk := 'critical';
  END IF;

  UPDATE public.inspections
  SET compliance_score = v_score,
      risk_level = v_risk
  WHERE id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compliance_score
  AFTER INSERT OR UPDATE ON public.inspection_responses
  FOR EACH ROW EXECUTE FUNCTION public.calculate_compliance_score();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: get current user's user_roles.id
CREATE OR REPLACE FUNCTION public.current_user_roles_id()
RETURNS uuid AS $$
  SELECT id FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── user_roles ──
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers select own row" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('head','management','admin','audit')
  );

CREATE POLICY "Admin full access to user_roles" ON public.user_roles
  FOR ALL USING (public.current_user_role() = 'admin');

-- ── branch_types ──
ALTER TABLE public.branch_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth users select branch_types" ON public.branch_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin manage branch_types" ON public.branch_types
  FOR ALL USING (public.current_user_role() = 'admin');

-- ── branches ──
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth users select active branches" ON public.branches
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Admin manage branches" ON public.branches
  FOR ALL USING (public.current_user_role() = 'admin');

-- ── checklist_templates ──
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth users select active checklist items" ON public.checklist_templates
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Admin manage checklist_templates" ON public.checklist_templates
  FOR ALL USING (public.current_user_role() = 'admin');

-- ── inspections ──
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers select own inspections" ON public.inspections
  FOR SELECT USING (
    officer_id = public.current_user_roles_id()
    OR public.current_user_role() IN ('head','management','admin','audit')
  );

CREATE POLICY "Officers insert own inspections" ON public.inspections
  FOR INSERT WITH CHECK (
    officer_id = public.current_user_roles_id()
  );

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

CREATE POLICY "Head update status and comment" ON public.inspections
  FOR UPDATE USING (
    public.current_user_role() = 'head'
  );

CREATE POLICY "Admin full access to inspections" ON public.inspections
  FOR ALL USING (public.current_user_role() = 'admin');

-- ── inspection_responses ──
ALTER TABLE public.inspection_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_responses select" ON public.inspection_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND (
          i.officer_id = public.current_user_roles_id()
          OR public.current_user_role() IN ('head','management','admin')
        )
    )
  );

CREATE POLICY "inspection_responses insert" ON public.inspection_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
        AND i.status = 'draft'
    )
  );

CREATE POLICY "inspection_responses update" ON public.inspection_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
        AND i.status = 'draft'
    )
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "inspection_responses delete" ON public.inspection_responses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
        AND i.status = 'draft'
    )
    OR public.current_user_role() = 'admin'
  );

-- ── inspection_files ──
ALTER TABLE public.inspection_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_files select" ON public.inspection_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND (
          i.officer_id = public.current_user_roles_id()
          OR public.current_user_role() IN ('head','management','admin')
        )
    )
  );

CREATE POLICY "inspection_files insert" ON public.inspection_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
  );

CREATE POLICY "inspection_files delete" ON public.inspection_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
    OR public.current_user_role() = 'admin'
  );

-- ── general_remarks ──
ALTER TABLE public.general_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "general_remarks select" ON public.general_remarks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND (
          i.officer_id = public.current_user_roles_id()
          OR public.current_user_role() IN ('head','management','admin')
        )
    )
  );

CREATE POLICY "general_remarks insert" ON public.general_remarks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
  );

CREATE POLICY "general_remarks delete" ON public.general_remarks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
    OR public.current_user_role() = 'admin'
  );

-- ============================================================
-- SEED DATA
-- ============================================================

-- Branch Types
INSERT INTO public.branch_types (type_name) VALUES
  ('CFC'),
  ('Store')
ON CONFLICT (type_name) DO NOTHING;

-- Checklist Templates (NULL branch_type_id = applies to all types)
INSERT INTO public.checklist_templates (branch_type_id, section, item_text, item_order) VALUES
  -- SECTION: Basic Details
  (NULL, 'Basic Details',        'Any prior complaints on this store',           1),

  -- SECTION: General Observation
  (NULL, 'General Observation',  'Store opening/closing discipline maintained',  2),
  (NULL, 'General Observation',  'Cleanliness & hygiene condition',              3),
  (NULL, 'General Observation',  'Customer movement',                            4),
  (NULL, 'General Observation',  'Any unusual activity observed',                5),
  (NULL, 'General Observation',  'Staff behaviour towards customers',            6),

  -- SECTION: Cash & Billing
  (NULL, 'Cash & Billing',       'Cash counter functioning smoothly',            7),
  (NULL, 'Cash & Billing',       'Bills issued for all visible transactions',    8),
  (NULL, 'Cash & Billing',       'Any manual billing observed',                  9),
  (NULL, 'Cash & Billing',       'Bill person available at counter',             10),

  -- SECTION: Stock & Inventory
  (NULL, 'Stock & Inventory',    'Shelves adequately filled',                    11),
  (NULL, 'Stock & Inventory',    'Empty racks or stock-out items',               12),
  (NULL, 'Stock & Inventory',    'Expired products visible',                     13),
  (NULL, 'Stock & Inventory',    'Damaged or leaking products',                  14),
  (NULL, 'Stock & Inventory',    'MRP tampering observed',                       15),
  (NULL, 'Stock & Inventory',    'Storage condition proper',                     16),

  -- SECTION: Staff Discipline
  (NULL, 'Staff Discipline',     'Staff in uniform / ID card',                   17),
  (NULL, 'Staff Discipline',     'Internal conflicts observed',                  18),
  (NULL, 'Staff Discipline',     'Staff actively engaged',                       19),
  (NULL, 'Staff Discipline',     'Unauthorized persons in staff area',           20),
  (NULL, 'Staff Discipline',     'Late attendance or absenteeism',               21),

  -- SECTION: Security
  (NULL, 'Security',             'CCTV cameras functional',                      22),
  (NULL, 'Security',             'Blind spots noticed',                          23),
  (NULL, 'Security',             'Fire safety equipment available',              24),
  (NULL, 'Security',             'Emergency exit accessible',                    25),
  (NULL, 'Security',             'Suspicious activity observed',                 26),

  -- SECTION: Regulatory
  (NULL, 'Regulatory',           'Local authority interference',                 27),
  (NULL, 'Regulatory',           'Municipality/Panchayat issues',                28),
  (NULL, 'Regulatory',           'Police/political interference',                29),
  (NULL, 'Regulatory',           'Licenses displayed',                           30),
  (NULL, 'Regulatory',           'Closure threats or disputes',                  31);

-- Sample Branches (Kerala, India)
-- CFC Branches
INSERT INTO public.branches (branch_type_id, branch_name, location, city, region, latitude, longitude)
SELECT
  bt.id,
  b.branch_name, b.location, b.city, b.region, b.latitude, b.longitude
FROM (
  VALUES
    ('CFC Ernakulam Central',   'MG Road, Ernakulam',              'Ernakulam',  'Central Kerala', 9.9816358,  76.2999099),
    ('CFC Thrissur Main',       'Round South, Thrissur',           'Thrissur',   'Central Kerala', 10.5276416, 76.2144349),
    ('CFC Kozhikode City',      'SM Street, Kozhikode',            'Kozhikode',  'North Kerala',   11.2587531, 75.7803993),
    ('CFC Trivandrum East',     'Palayam, Thiruvananthapuram',     'Trivandrum', 'South Kerala',   8.5241391,  76.9366376),
    ('CFC Kottayam Central',    'KK Road, Kottayam',               'Kottayam',   'Central Kerala', 9.5915668,  76.5221531)
) AS b(branch_name, location, city, region, latitude, longitude),
public.branch_types bt
WHERE bt.type_name = 'CFC';

-- Store Branches
INSERT INTO public.branches (branch_type_id, branch_name, location, city, region, latitude, longitude)
SELECT
  bt.id,
  b.branch_name, b.location, b.city, b.region, b.latitude, b.longitude
FROM (
  VALUES
    ('Store Thrissur East',     'Punkunnam, Thrissur',             'Thrissur',   'Central Kerala', 10.5354553, 76.2282991),
    ('Store Palakkad Market',   'Town Hall Road, Palakkad',        'Palakkad',   'North Kerala',   10.7867303, 76.6547932),
    ('Store Kollam Bay',        'Chinnakada, Kollam',              'Kollam',     'South Kerala',   8.8932118,  76.6141396),
    ('Store Kannur North',      'Fort Road, Kannur',               'Kannur',     'North Kerala',   11.8744775, 75.3703624),
    ('Store Alappuzha Harbour', 'Mullackal, Alappuzha',            'Alappuzha',  'Central Kerala', 9.4981024,  76.3388481)
) AS b(branch_name, location, city, region, latitude, longitude),
public.branch_types bt
WHERE bt.type_name = 'Store';

-- ============================================================
-- END OF SCHEMA
-- ============================================================

-- ============================================================
-- STORE + OFFICER VIGILANCE ARCHITECTURE (COMPATIBILITY PATCH)
-- Safe to run multiple times
-- ============================================================

-- 1) Ensure stores table exists
CREATE TABLE IF NOT EXISTS public.stores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  store_incharge text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2) Add requested store columns
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_code   text,
  ADD COLUMN IF NOT EXISTS store_phone  text,
  ADD COLUMN IF NOT EXISTS am           text,
  ADD COLUMN IF NOT EXISTS am_number    text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS lat          double precision,
  ADD COLUMN IF NOT EXISTS lng          double precision;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_store_code_key'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);
  END IF;
END
$$;

-- 3) Create requested inspections shape when table does not exist
CREATE TABLE IF NOT EXISTS public.inspections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  officer_id    uuid REFERENCES auth.users(id),
  checklist     jsonb NOT NULL DEFAULT '{}'::jsonb,
  remarks       text,
  officer_lat   double precision,
  officer_lng   double precision,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);

-- 4) Add requested columns for compatibility when inspections already exists
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS store_id     uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS checklist    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS remarks      text,
  ADD COLUMN IF NOT EXISTS officer_lat  double precision,
  ADD COLUMN IF NOT EXISTS officer_lng  double precision;

-- 5) Enable Realtime publication safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'inspections'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'stores'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
    END IF;
  END IF;
END
$$;

-- 6) RLS on stores — without these, authenticated users see ZERO rows
--    because RLS is enabled by default but no policy grants access.
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All auth users select stores" ON public.stores;
CREATE POLICY "All auth users select stores" ON public.stores
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin manage stores" ON public.stores;
CREATE POLICY "Admin manage stores" ON public.stores
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
