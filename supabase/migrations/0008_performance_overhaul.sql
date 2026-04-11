-- ============================================================================
-- 0008_performance_overhaul.sql
-- Performance metrics overhaul: auto-calculated dispatched quantity + relational
-- travelling cities.
-- ============================================================================
-- Changes:
--   1. monthly_actuals:
--      - DROP actual_dispatched_amount, actual_tour_days, actual_travelling_cities
--      - DROP actual_dispatched_sqft (will be re-added as a generated column)
--      - ADD raw inputs: actual_return, actual_project_2, actual_project,
--        actual_tile, actual_retail
--      - ADD generated: actual_net_sale      = project_2 + project + tile + retail
--      - ADD generated: actual_dispatched_sqft = net_sale + return
--        (expanded inline since PG generated cols can't reference other gen cols)
--   2. monthly_targets:
--      - DROP target_tour_days (now aggregated from monthly_city_tours)
--   3. NEW: cities table (central pool, super_admin managed)
--   4. NEW: monthly_city_tours table (per-month per-city target + actual days)
-- ============================================================================

-- NOTE: Test data only — DROPs below are destructive but acceptable.


-- ============================================================================
-- 1. MONTHLY_ACTUALS — drop removed columns & re-shape dispatched breakdown
-- ============================================================================

ALTER TABLE public.monthly_actuals
  DROP COLUMN IF EXISTS actual_dispatched_amount,
  DROP COLUMN IF EXISTS actual_tour_days,
  DROP COLUMN IF EXISTS actual_travelling_cities,
  DROP COLUMN IF EXISTS actual_dispatched_sqft;

ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_return    INT NOT NULL DEFAULT 0,
  ADD COLUMN actual_project_2 INT NOT NULL DEFAULT 0,
  ADD COLUMN actual_project   INT NOT NULL DEFAULT 0,
  ADD COLUMN actual_tile      INT NOT NULL DEFAULT 0,
  ADD COLUMN actual_retail    INT NOT NULL DEFAULT 0;

-- Generated columns (cannot reference each other in PG, so expand inline)
ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_net_sale INT
    GENERATED ALWAYS AS (
      actual_project_2 + actual_project + actual_tile + actual_retail
    ) STORED;

ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_dispatched_sqft INT
    GENERATED ALWAYS AS (
      actual_project_2 + actual_project + actual_tile + actual_retail + actual_return
    ) STORED;

COMMENT ON COLUMN public.monthly_actuals.actual_net_sale        IS 'Auto-calculated: project_2 + project + tile + retail.';
COMMENT ON COLUMN public.monthly_actuals.actual_dispatched_sqft IS 'Auto-calculated: net_sale + return.';


-- ============================================================================
-- 2. MONTHLY_TARGETS — drop target_tour_days (now aggregated)
-- ============================================================================

ALTER TABLE public.monthly_targets
  DROP COLUMN IF EXISTS target_tour_days;


-- ============================================================================
-- 3. CITIES TABLE — central pool managed by super_admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cities (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cities IS 'Central pool of cities. Managers/employees pick from this list when logging monthly travel.';

-- Seed with common Indian metros
INSERT INTO public.cities (name) VALUES
  ('Delhi'),
  ('Mumbai'),
  ('Bangalore'),
  ('Jaipur'),
  ('Chennai'),
  ('Kolkata'),
  ('Hyderabad'),
  ('Pune'),
  ('Ahmedabad'),
  ('Lucknow')
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- 4. MONTHLY_CITY_TOURS — relational per-city tour days
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_city_tours (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  city_id     UUID NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  target_days INT NOT NULL DEFAULT 0,
  actual_days INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, month, year, city_id)
);

COMMENT ON TABLE public.monthly_city_tours IS
  'Per-employee, per-month, per-city tour days. Replaces the flat actual_travelling_cities + tour_days columns.';

CREATE INDEX IF NOT EXISTS idx_monthly_city_tours_employee_period
  ON public.monthly_city_tours (employee_id, year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_city_tours_city
  ON public.monthly_city_tours (city_id);

-- Reuse the shared updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.monthly_city_tours;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monthly_city_tours
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 5. RLS — cities + monthly_city_tours
-- ============================================================================

-- ── cities ──
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_select" ON public.cities;
CREATE POLICY "cities_select"
  ON public.cities FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "cities_insert" ON public.cities;
CREATE POLICY "cities_insert"
  ON public.cities FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "cities_update" ON public.cities;
CREATE POLICY "cities_update"
  ON public.cities FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "cities_delete" ON public.cities;
CREATE POLICY "cities_delete"
  ON public.cities FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ── monthly_city_tours ──
ALTER TABLE public.monthly_city_tours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_city_tours_select" ON public.monthly_city_tours;
CREATE POLICY "monthly_city_tours_select"
  ON public.monthly_city_tours FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "monthly_city_tours_insert" ON public.monthly_city_tours;
CREATE POLICY "monthly_city_tours_insert"
  ON public.monthly_city_tours FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

DROP POLICY IF EXISTS "monthly_city_tours_update" ON public.monthly_city_tours;
CREATE POLICY "monthly_city_tours_update"
  ON public.monthly_city_tours FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager', 'editor'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

DROP POLICY IF EXISTS "monthly_city_tours_delete" ON public.monthly_city_tours;
CREATE POLICY "monthly_city_tours_delete"
  ON public.monthly_city_tours FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager', 'editor'));


-- ============================================================================
-- DONE. Performance overhaul migration complete.
-- ============================================================================
