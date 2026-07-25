-- ============================================================================
-- 0025_comparative_report_functions.sql
-- ARRAY-based comparative report RPCs powering the new "Compare" sub-tabs.
-- Where 0023 answers "how did ONE employee do on every metric", these answer
-- "how do THESE employees stack up against each other on ONE metric" — so each
-- takes a uuid[] and returns one partition PER EMPLOYEE, keeping the fan-out
-- aggregation in SQL (one round-trip, no N+1 of the single-employee RPCs).
-- ============================================================================
-- WHY THREE FUNCTIONS  (mirrors 0023's two-tier split)
--   • DAILY   (daily_metrics)                       → #1 comparative meetings
--   • MONTHLY (monthly_actuals + monthly_targets)   → #2 comparative monthly,
--       a LEAN wide row (headline value + target per measure) that serves the
--       Dispatch / Visits / Conversion / Costing compares — comparison cares
--       about the head-to-head total, not the single-employee product/cost mix,
--       so this deliberately omits 0023's breakdown columns.
--   • TOUR    (monthly_city_tours)                  → #3 comparative tour, which
--       reduces per-city rows to one totals row per employee (target/actual days
--       + cities covered) — the cross-employee comparison is "who covered more",
--       not the per-city radar.
--
-- SCOPING & SECURITY  (identical doctrine to 0023)
--   The caller passes only ids from its own roster; the Compare pages restrict
--   the multi-select to getEmployeesForUser AND re-validate every id server-side
--   before prefetch, mirroring how 0022/0023 trust app-layer scoping over the
--   permissive USING(true) RLS on these tables. STABLE + SECURITY INVOKER so RLS
--   still applies; explicit GRANT EXECUTE TO authenticated. Read-only.
--
--   `= ANY(_employee_ids)` is the array membership test; every function GROUPs by
--   employee_id so a caller gets one clean partition per selected employee.
-- ============================================================================


-- ============================================================================
-- 1. COMPARATIVE MEETINGS — DAILY tier (daily_metrics)
-- ----------------------------------------------------------------------------
-- One row per (employee, time bucket). `meetings` is the COMBINED architect +
-- client + site-visits universe (migration 0004) — exactly what
-- target_total_meetings is defined over — so the head-to-head compares like with
-- like. _bucket ∈ {day, week, month}; anything else degrades to 'day'. The
-- client picks the bucket from the selected span, so one function serves every
-- horizon from "Last 30 Days" to "Last 12 Months".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_comparative_meetings_series(
  _employee_ids UUID[],
  _from         DATE,
  _to           DATE,
  _bucket       TEXT DEFAULT 'day'
)
RETURNS TABLE (
  employee_id     UUID,
  bucket_start    DATE,
  meetings        INT,
  calls           INT,
  target_meetings INT
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
    COALESCE(SUM(
      dm.actual_architect_meetings
      + dm.actual_client_meetings
      + dm.actual_site_visits
    ), 0)::INT AS meetings,
    COALESCE(SUM(dm.actual_calls),          0)::INT AS calls,
    COALESCE(SUM(dm.target_total_meetings), 0)::INT AS target_meetings
  FROM public.daily_metrics dm
  WHERE dm.employee_id = ANY(_employee_ids)
    AND dm.date >= _from
    AND dm.date <= _to
  GROUP BY dm.employee_id, 2
  ORDER BY dm.employee_id, 2;
$$;

COMMENT ON FUNCTION public.get_comparative_meetings_series(UUID[], DATE, DATE, TEXT) IS
  'Head-to-head daily-tier meetings (architect+client+site-visits) + calls + target per employee, bucketed by day/week/month over [_from, _to]. One partition per id in _employee_ids. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_meetings_series(UUID[], DATE, DATE, TEXT) TO authenticated;


-- ============================================================================
-- 2. COMPARATIVE MONTHLY — Dispatch / Visits / Conversion / Costing
-- ----------------------------------------------------------------------------
-- One row per (employee, month) present in actuals OR targets (FULL OUTER JOIN
-- keyed on employee+month+year, so employees never cross-join). A LEAN wide row:
-- the headline actual + target for each comparable measure, every measure cast
-- to NUMERIC for a stable return type. The client zero-fills month gaps, derives
-- the conversion rate (conversions / client_visits) and picks the one measure
-- its page compares.
-- ============================================================================
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
  dispatched_sqft        NUMERIC,
  target_dispatched_sqft NUMERIC,
  client_visits          NUMERIC,
  target_client_visits   NUMERIC,
  conversions            NUMERIC,
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
    COALESCE(a.actual_dispatched_sqft, 0)::NUMERIC,
    COALESCE(t.target_dispatched_sqft, 0)::NUMERIC,
    COALESCE(a.actual_client_visits,   0)::NUMERIC,
    COALESCE(t.target_client_visits,   0)::NUMERIC,
    COALESCE(a.actual_conversions,     0)::NUMERIC,
    COALESCE(a.total_costing,          0)::NUMERIC
  FROM a
  FULL OUTER JOIN t
    ON a.employee_id = t.employee_id
   AND a.month = t.month
   AND a.year  = t.year
  ORDER BY 1, 3, 2;
$$;

COMMENT ON FUNCTION public.get_comparative_monthly_series(UUID[], INT, INT, INT, INT) IS
  'Head-to-head lean monthly series (dispatched sqft, client visits, conversions, total costing + the two targets) per employee over an inclusive [from, to] month window. One row per (employee, month) present in actuals OR targets. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_monthly_series(UUID[], INT, INT, INT, INT) TO authenticated;


-- ============================================================================
-- 3. COMPARATIVE TOUR — per-employee totals over the window
-- ----------------------------------------------------------------------------
-- Reduces monthly_city_tours to ONE row per employee: total target & actual
-- days summed across all their cities, plus how many distinct cities they
-- actually toured (actual_days > 0). The cross-employee comparison is a totals
-- leaderboard, so — unlike 0023's per-city radar — the city dimension collapses
-- here. Employees with no tour rows in the window simply don't appear; the
-- client zero-fills them from the selected id list.
-- ============================================================================
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
  cities_covered INT
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
    COALESCE(SUM(per_city.td), 0)::NUMERIC          AS target_days,
    COALESCE(SUM(per_city.ad), 0)::NUMERIC          AS actual_days,
    COUNT(*) FILTER (WHERE per_city.ad > 0)::INT    AS cities_covered
  FROM per_city
  GROUP BY per_city.employee_id;
$$;

COMMENT ON FUNCTION public.get_comparative_tour_series(UUID[], INT, INT, INT, INT) IS
  'Head-to-head tour totals per employee (target days, actual days, distinct cities toured) over an inclusive [from, to] month window. One row per employee with any tour rows in-window. STABLE + SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.get_comparative_tour_series(UUID[], INT, INT, INT, INT) TO authenticated;

-- ============================================================================
-- DONE. Three read-only comparative report functions, granted to authenticated.
-- ============================================================================
