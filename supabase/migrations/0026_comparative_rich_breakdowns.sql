-- ============================================================================
-- 0026_comparative_rich_breakdowns.sql
-- Widens the three comparative RPCs from 0025 so the Compare views can render a
-- RICH per-employee breakdown table (management prioritises raw numbers over
-- trendlines), not just a headline total + attainment.
-- ============================================================================
-- WHY DROP + RECREATE (not CREATE OR REPLACE)
--   Postgres refuses to change the return type of an existing function:
--   "cannot change return type of existing function". Adding columns to a
--   RETURNS TABLE is exactly that, so each function must be DROPped first.
--   Dropping also drops its GRANTs, hence every GRANT is re-issued below.
--   Argument signatures are UNCHANGED, so the client call sites keep working.
--
-- WHAT CHANGED PER FUNCTION
--   • meetings — was one combined `meetings` figure; now also returns the
--     architect / client / site-visit split that sums to it, plus target_calls.
--     Meetings still ships pre-summed so the trend line needs no client math.
--   • monthly  — was deliberately "lean" (headline + target only). The compare
--     tables need the same depth as the single-employee cards, so it now carries
--     the full dispatch product mix (commercial…return + net sale) and the full
--     costing breakdown (salary / tada / incentive / vendor / sales promotion).
--     It stays ONE payload shared by the Dispatch, Visits, Conversion and
--     Costing compares — each page just reads different columns.
--   • tour     — adds cities_planned (distinct cities with planned days), so the
--     table can show covered-vs-planned city counts rather than covered alone.
--
-- Scoping/security posture is unchanged from 0025: STABLE, SECURITY INVOKER,
-- `= ANY(_employee_ids)`, app-layer roster scoping, GRANT to authenticated.
-- ============================================================================


-- ============================================================================
-- 1. COMPARATIVE MEETINGS — DAILY tier, now with the activity split
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_comparative_meetings_series(UUID[], DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_comparative_meetings_series(
  _employee_ids UUID[],
  _from         DATE,
  _to           DATE,
  _bucket       TEXT DEFAULT 'day'
)
RETURNS TABLE (
  employee_id        UUID,
  bucket_start       DATE,
  architect_meetings INT,
  client_meetings    INT,
  site_visits        INT,
  meetings           INT,
  calls              INT,
  target_meetings    INT,
  target_calls       INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dm.employee_id,
    date_trunc(
      CASE WHEN _bucket IN ('day', 'week', 'month') THEN _bucket ELSE 'day' END,
      dm.date
    )::DATE AS bucket_start,
    COALESCE(SUM(dm.actual_architect_meetings), 0)::INT AS architect_meetings,
    COALESCE(SUM(dm.actual_client_meetings),    0)::INT AS client_meetings,
    COALESCE(SUM(dm.actual_site_visits),        0)::INT AS site_visits,
    COALESCE(SUM(
      dm.actual_architect_meetings
      + dm.actual_client_meetings
      + dm.actual_site_visits
    ), 0)::INT AS meetings,
    COALESCE(SUM(dm.actual_calls),          0)::INT AS calls,
    COALESCE(SUM(dm.target_total_meetings), 0)::INT AS target_meetings,
    COALESCE(SUM(dm.target_calls),          0)::INT AS target_calls
  FROM public.daily_metrics dm
  WHERE dm.employee_id = ANY(_employee_ids)
    AND dm.date >= _from
    AND dm.date <= _to
  GROUP BY dm.employee_id, 2
  ORDER BY dm.employee_id, 2;
$$;

COMMENT ON FUNCTION public.get_comparative_meetings_series(UUID[], DATE, DATE, TEXT) IS
  'Head-to-head daily-tier activity per employee — architect/client/site split, their combined meetings total, calls, and both targets — bucketed by day/week/month over [_from, _to]. One partition per id in _employee_ids. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_meetings_series(UUID[], DATE, DATE, TEXT) TO authenticated;


-- ============================================================================
-- 2. COMPARATIVE MONTHLY — now the FULL dispatch + costing breakdown
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_comparative_monthly_series(UUID[], INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_comparative_monthly_series(
  _employee_ids UUID[],
  _from_month   INT,
  _from_year    INT,
  _to_month     INT,
  _to_year      INT
)
RETURNS TABLE (
  employee_id            UUID,
  month                  INT,
  year                   INT,
  -- Dispatch breakdown (sqft) — the six parts sum to dispatched_sqft
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
    WHERE ma.employee_id = ANY(_employee_ids)
      AND (ma.year * 12 + ma.month) BETWEEN b.from_ord AND b.to_ord
  ),
  t AS (
    SELECT mt.* FROM public.monthly_targets mt, bounds b
    WHERE mt.employee_id = ANY(_employee_ids)
      AND (mt.year * 12 + mt.month) BETWEEN b.from_ord AND b.to_ord
  )
  SELECT
    COALESCE(a.employee_id, t.employee_id)          AS employee_id,
    COALESCE(a.month, t.month)::INT                 AS month,
    COALESCE(a.year,  t.year)::INT                  AS year,
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
  FULL OUTER JOIN t
    ON a.employee_id = t.employee_id
   AND a.month = t.month
   AND a.year  = t.year
  ORDER BY 1, 3, 2;
$$;

COMMENT ON FUNCTION public.get_comparative_monthly_series(UUID[], INT, INT, INT, INT) IS
  'Head-to-head wide monthly series per employee (full dispatch product mix + net sale, client visits, conversions, full costing breakdown, plus the two targets) over an inclusive [from, to] month window. One row per (employee, month) present in actuals OR targets; shared by the Dispatch/Visits/Conversion/Costing compares. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_monthly_series(UUID[], INT, INT, INT, INT) TO authenticated;


-- ============================================================================
-- 3. COMPARATIVE TOUR — adds cities_planned alongside cities_covered
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_comparative_tour_series(UUID[], INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_comparative_tour_series(
  _employee_ids UUID[],
  _from_month   INT,
  _from_year    INT,
  _to_month     INT,
  _to_year      INT
)
RETURNS TABLE (
  employee_id    UUID,
  target_days    NUMERIC,
  actual_days    NUMERIC,
  cities_covered INT,
  cities_planned INT
)
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT (_from_year * 12 + _from_month) AS from_ord,
           (_to_year   * 12 + _to_month)   AS to_ord
  ),
  per_city AS (
    SELECT
      mct.employee_id,
      mct.city_id,
      COALESCE(SUM(mct.target_days), 0) AS td,
      COALESCE(SUM(mct.actual_days), 0) AS ad
    FROM public.monthly_city_tours mct
    CROSS JOIN bounds b
    WHERE mct.employee_id = ANY(_employee_ids)
      AND (mct.year * 12 + mct.month) BETWEEN b.from_ord AND b.to_ord
    GROUP BY mct.employee_id, mct.city_id
  )
  SELECT
    per_city.employee_id,
    COALESCE(SUM(per_city.td), 0)::NUMERIC       AS target_days,
    COALESCE(SUM(per_city.ad), 0)::NUMERIC       AS actual_days,
    COUNT(*) FILTER (WHERE per_city.ad > 0)::INT AS cities_covered,
    COUNT(*) FILTER (WHERE per_city.td > 0)::INT AS cities_planned
  FROM per_city
  GROUP BY per_city.employee_id;
$$;

COMMENT ON FUNCTION public.get_comparative_tour_series(UUID[], INT, INT, INT, INT) IS
  'Head-to-head tour totals per employee (target days, actual days, cities toured, cities planned) over an inclusive [from, to] month window. One row per employee with any tour rows in-window. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_tour_series(UUID[], INT, INT, INT, INT) TO authenticated;

-- ============================================================================
-- DONE. Three widened comparative functions, re-granted to authenticated.
-- ============================================================================
