-- ============================================================================
-- 0023_employee_report_functions.sql
-- Per-EMPLOYEE report RPCs powering the new "Report" tab. One function per
-- data SHAPE (not per chart), so each chart card can filter its own time
-- window independently by calling the relevant function with its own range.
-- ============================================================================
-- WHY THREE FUNCTIONS
--   The metrics live at two granularities:
--     • DAILY  (daily_metrics): meetings / calls / site-visits  → fn #1
--     • MONTHLY (monthly_actuals, monthly_city_tours)           → fn #2, #3
--   The four monthly cards (Dispatch, Visits, Conversion, Costing) share ONE
--   wide monthly function; each still filters independently because each card
--   invokes it with its own [from, to] window (a distinct query key). Tour is
--   per-city (a different row shape), so it gets its own function.
--
-- SCOPING & SECURITY
--   Each function takes a SINGLE _employee_id. The Report page restricts the
--   employee selector to the caller's roster (getEmployeesForUser) and revalidates
--   the requested id server-side, mirroring how get_dashboard_kpis (0022) trusts
--   app-layer scoping over the permissive USING(true) RLS on these tables.
--   STABLE + SECURITY INVOKER (default) so RLS still applies; explicit
--   GRANT EXECUTE TO authenticated per the secure-by-default doctrine (0019/0020).
--   Read-only — no data is mutated.
-- ============================================================================


-- ============================================================================
-- 1. MEETINGS & FIELD ACTIVITY — DAILY tier (daily_metrics)
-- ----------------------------------------------------------------------------
-- Returns one row per time bucket. _bucket ∈ {day, week, month}; anything else
-- degrades to 'day'. The client picks the bucket from the selected span (e.g.
-- "Last 7 Days" → day, "This FY" → month) so one function serves every horizon.
-- target_total_meetings is the COMBINED architect+client+site-visits bucket
-- (migration 0004); the three actual components sum to that same universe.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_meetings_series(
  _employee_id UUID,
  _from        DATE,
  _to          DATE,
  _bucket      TEXT DEFAULT 'day'
)
RETURNS TABLE (
  bucket_start       DATE,
  architect_meetings INT,
  client_meetings    INT,
  site_visits        INT,
  calls              INT,
  target_meetings    INT,
  target_calls       INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    date_trunc(
      CASE WHEN _bucket IN ('day', 'week', 'month') THEN _bucket ELSE 'day' END,
      dm.date
    )::DATE                                          AS bucket_start,
    COALESCE(SUM(dm.actual_architect_meetings), 0)::INT,
    COALESCE(SUM(dm.actual_client_meetings),    0)::INT,
    COALESCE(SUM(dm.actual_site_visits),        0)::INT,
    COALESCE(SUM(dm.actual_calls),              0)::INT,
    COALESCE(SUM(dm.target_total_meetings),     0)::INT,
    COALESCE(SUM(dm.target_calls),              0)::INT
  FROM public.daily_metrics dm
  WHERE dm.employee_id = _employee_id
    AND dm.date >= _from
    AND dm.date <= _to
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_employee_meetings_series(UUID, DATE, DATE, TEXT) IS
  'Per-employee daily-tier activity (architect/client meetings, site visits, calls + targets) bucketed by day/week/month over [_from, _to]. STABLE + SECURITY INVOKER. supabase.rpc(''get_employee_meetings_series'', {...}).';

GRANT EXECUTE ON FUNCTION public.get_employee_meetings_series(UUID, DATE, DATE, TEXT) TO authenticated;


-- ============================================================================
-- 2. MONTHLY WIDE SERIES — Dispatch, Visits, Conversion, Costing
-- ----------------------------------------------------------------------------
-- One row per month in the inclusive [from, to] window that has an actuals OR
-- a targets row (FULL OUTER JOIN). Every measure cast to NUMERIC so the return
-- type is stable regardless of the underlying INT/NUMERIC column types. The
-- client zero-fills any month gaps and derives ratios (conversion rate, %).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_monthly_series(
  _employee_id UUID,
  _from_month  INT,
  _from_year   INT,
  _to_month    INT,
  _to_year     INT
)
RETURNS TABLE (
  month                  INT,
  year                   INT,
  -- Dispatch breakdown (sqft)
  commercial_project     NUMERIC,
  hotel_project          NUMERIC,
  project_2              NUMERIC,
  tile                   NUMERIC,
  retail                 NUMERIC,
  return_sqft            NUMERIC,
  net_sale               NUMERIC,
  dispatched_sqft        NUMERIC,
  target_dispatched_sqft NUMERIC,
  -- Visits & conversion
  client_visits          NUMERIC,
  target_client_visits   NUMERIC,
  conversions            NUMERIC,
  -- Costing breakdown (INR)
  salary                 NUMERIC,
  tada                   NUMERIC,
  incentive              NUMERIC,
  vendor_costing         NUMERIC,
  sales_promotion        NUMERIC,
  total_costing          NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT (_from_year * 12 + _from_month) AS from_ord,
           (_to_year   * 12 + _to_month)   AS to_ord
  ),
  a AS (
    SELECT ma.* FROM public.monthly_actuals ma, bounds b
    WHERE ma.employee_id = _employee_id
      AND (ma.year * 12 + ma.month) BETWEEN b.from_ord AND b.to_ord
  ),
  t AS (
    SELECT mt.* FROM public.monthly_targets mt, bounds b
    WHERE mt.employee_id = _employee_id
      AND (mt.year * 12 + mt.month) BETWEEN b.from_ord AND b.to_ord
  )
  SELECT
    COALESCE(a.month, t.month)::INT                  AS month,
    COALESCE(a.year,  t.year)::INT                   AS year,
    COALESCE(a.actual_commercial_project, 0)::NUMERIC,
    COALESCE(a.actual_hotel_project,      0)::NUMERIC,
    COALESCE(a.actual_project_2,          0)::NUMERIC,
    COALESCE(a.actual_tile,               0)::NUMERIC,
    COALESCE(a.actual_retail,             0)::NUMERIC,
    COALESCE(a.actual_return,             0)::NUMERIC,
    COALESCE(a.actual_net_sale,           0)::NUMERIC,
    COALESCE(a.actual_dispatched_sqft,    0)::NUMERIC,
    COALESCE(t.target_dispatched_sqft,    0)::NUMERIC,
    COALESCE(a.actual_client_visits,      0)::NUMERIC,
    COALESCE(t.target_client_visits,      0)::NUMERIC,
    COALESCE(a.actual_conversions,        0)::NUMERIC,
    COALESCE(a.salary,                    0)::NUMERIC,
    COALESCE(a.tada,                      0)::NUMERIC,
    COALESCE(a.incentive,                 0)::NUMERIC,
    COALESCE(a.actual_vendor_costing,     0)::NUMERIC,
    COALESCE(a.sales_promotion,           0)::NUMERIC,
    COALESCE(a.total_costing,             0)::NUMERIC
  FROM a
  FULL OUTER JOIN t ON a.month = t.month AND a.year = t.year
  ORDER BY 2, 1;
$$;

COMMENT ON FUNCTION public.get_employee_monthly_series(UUID, INT, INT, INT, INT) IS
  'Per-employee monthly series (dispatch breakdown, client visits, conversions, costing breakdown + targets) over an inclusive [from, to] month window. One row per month present in actuals OR targets. STABLE + SECURITY INVOKER. supabase.rpc(''get_employee_monthly_series'', {...}).';

GRANT EXECUTE ON FUNCTION public.get_employee_monthly_series(UUID, INT, INT, INT, INT) TO authenticated;


-- ============================================================================
-- 3. TOUR — per-city day sums over the window (monthly_city_tours + cities)
-- ----------------------------------------------------------------------------
-- Aggregates target/actual days per city across the window for the radar/bar.
-- HAVING drops cities with neither planned nor actual days so the radar only
-- plots cities that are actually in play. Ordered by actual desc for the bar
-- fallback (top cities first).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_tour_series(
  _employee_id UUID,
  _from_month  INT,
  _from_year   INT,
  _to_month    INT,
  _to_year     INT
)
RETURNS TABLE (
  city_name   TEXT,
  target_days NUMERIC,
  actual_days NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT (_from_year * 12 + _from_month) AS from_ord,
           (_to_year   * 12 + _to_month)   AS to_ord
  )
  SELECT
    c.name                                     AS city_name,
    COALESCE(SUM(mct.target_days), 0)::NUMERIC AS target_days,
    COALESCE(SUM(mct.actual_days), 0)::NUMERIC AS actual_days
  FROM public.monthly_city_tours mct
  JOIN public.cities c ON c.id = mct.city_id
  CROSS JOIN bounds b
  WHERE mct.employee_id = _employee_id
    AND (mct.year * 12 + mct.month) BETWEEN b.from_ord AND b.to_ord
  GROUP BY c.name
  HAVING COALESCE(SUM(mct.target_days), 0) > 0
      OR COALESCE(SUM(mct.actual_days), 0) > 0
  ORDER BY actual_days DESC, city_name;
$$;

COMMENT ON FUNCTION public.get_employee_tour_series(UUID, INT, INT, INT, INT) IS
  'Per-employee per-city tour days (target + actual) summed over an inclusive [from, to] month window, for the Tour radar/bar. STABLE + SECURITY INVOKER. supabase.rpc(''get_employee_tour_series'', {...}).';

GRANT EXECUTE ON FUNCTION public.get_employee_tour_series(UUID, INT, INT, INT, INT) TO authenticated;

-- ============================================================================
-- DONE. Three read-only report functions, granted to authenticated.
-- ============================================================================
