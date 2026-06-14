-- ============================================================
-- VIGILANCE — STORES TABLE + RLS + INSPECTIONS COMPAT
-- Date: 2026-05-14
-- ============================================================
-- Stands up the supermarket-directory side of the schema so the web
-- dashboard's StoreList / StoreDetail pages have something to query.
--
--   * Creates public.stores with all client-requested columns
--   * Adds the store_code UNIQUE constraint (idempotent guard)
--   * Enables RLS on stores with read-for-authenticated + admin-manage
--   * Adds compatibility columns on inspections so the web app's
--     `store_id` + `checklist` jsonb shape works alongside the existing
--     officer-app shape (branch_id + inspection_responses)
--   * Re-asserts the supabase_realtime publication for stores / inspections
--
-- Mirrors the COMPATIBILITY PATCH block at the bottom of schema.sql.
-- Idempotent — safe to re-run.
-- ============================================================


-- ── 1) public.stores ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  store_incharge  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

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
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stores_store_code_key'
       AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);
  END IF;
END
$$;

COMMENT ON TABLE public.stores IS
  'Supermarket directory consumed by the web dashboard. One row per physical store. '
  'store_code is the operations team''s canonical V### identifier.';


-- ── 2) RLS on stores ───────────────────────────────────────────────────────

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


-- ── 3) inspections compatibility columns ──────────────────────────────────
-- The base inspections table targets the officer-app shape (branch_id +
-- inspection_responses rows). The web dashboard expects a parallel
-- store_id + checklist (jsonb) shape on the same table. Both shapes can
-- coexist — null on the side that isn't in use for a given row.

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS store_id     uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS checklist    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS remarks      text,
  ADD COLUMN IF NOT EXISTS officer_lat  double precision,
  ADD COLUMN IF NOT EXISTS officer_lng  double precision;

CREATE INDEX IF NOT EXISTS idx_inspections_store_id
  ON public.inspections (store_id)
  WHERE store_id IS NOT NULL;


-- ── 4) Realtime publication ───────────────────────────────────────────────
-- The web StoreList subscribes to public.inspections INSERTs to flip the
-- "completed today" indicator. stores is published so admin edits show
-- up live too.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='inspections'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='stores'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
    END IF;
  END IF;
END
$$;


-- ============================================================
-- END OF MIGRATION
-- ============================================================
