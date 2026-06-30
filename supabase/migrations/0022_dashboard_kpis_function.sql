-- ============================================================================
-- 0022_dashboard_kpis_function.sql
-- get_dashboard_kpis — org-wide KPI rollup over an inclusive [from, to] month
-- range, for the Analytics Dashboard's 3 cards (Dispatch, Visits, Conversions).
-- ============================================================================
-- WHY A RANGE (not a single month)
--   The dashboard reuses the Cumulative Data range selector (This FY, Last FY,
--   Last N months, …), so the function takes a from/to window and the caller
--   invokes it twice — once for the selected window and once for the equivalent
--   previous window — to compute period-over-period deltas.
--
-- ROSTER SCOPING (_employee_ids)
--   RLS on monthly_targets / monthly_actuals is permissive (USING(true)), so a
--   naive SUM(*) would leak org-wide totals to a custom_admin. Scoping is an
--   app-layer concern: the fetcher resolves the caller's roster via
--   getEmployeesForUser and passes the id array. NULL means "every employee the
--   caller can read" (super_admin / editor / viewer) and skips the filter; an
--   empty array yields all-zero totals (a custom_admin with no assignments).
--
-- SECURITY
--   STABLE + SECURITY INVOKER (default) so the underlying RLS still applies, and
--   an explicit GRANT EXECUTE TO authenticated per the secure-by-default doctrine
--   (mirrors get_monthly_mtd in 0019). Reads only — no data is mutated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  _from_month   INT,
  _from_year    INT,
  _to_month     INT,
  _to_year      INT,
  _employee_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  dispatch_target    BIGINT,
  dispatch_actual    BIGINT,
  visits_target      BIGINT,
  visits_actual      BIGINT,
  conversions_actual BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    -- (year*12 + month) ordinal makes the range a single BETWEEN. An inverted
    -- window (from > to, e.g. a fully-future selection) matches no rows and
    -- degrades to zeros — the safe default.
    SELECT
      (_from_year * 12 + _from_month) AS from_ord,
      (_to_year   * 12 + _to_month)   AS to_ord
  ),
  tgt AS (
    SELECT
      COALESCE(SUM(mt.target_dispatched_sqft), 0)::BIGINT AS dispatch_target,
      COALESCE(SUM(mt.target_client_visits),   0)::BIGINT AS visits_target
    FROM public.monthly_targets mt, bounds b
    WHERE (mt.year * 12 + mt.month) BETWEEN b.from_ord AND b.to_ord
      AND (_employee_ids IS NULL OR mt.employee_id = ANY (_employee_ids))
  ),
  act AS (
    SELECT
      COALESCE(SUM(ma.actual_dispatched_sqft), 0)::BIGINT AS dispatch_actual,
      COALESCE(SUM(ma.actual_client_visits),   0)::BIGINT AS visits_actual,
      COALESCE(SUM(ma.actual_conversions),     0)::BIGINT AS conversions_actual
    FROM public.monthly_actuals ma, bounds b
    WHERE (ma.year * 12 + ma.month) BETWEEN b.from_ord AND b.to_ord
      AND (_employee_ids IS NULL OR ma.employee_id = ANY (_employee_ids))
  )
  SELECT
    tgt.dispatch_target,
    act.dispatch_actual,
    tgt.visits_target,
    act.visits_actual,
    act.conversions_actual
  FROM tgt, act;
$$;

COMMENT ON FUNCTION public.get_dashboard_kpis(INT, INT, INT, INT, UUID[]) IS
  'Org-wide dashboard KPI rollup over an inclusive [from, to] month range, scoped to _employee_ids (NULL = every employee the caller can read). Returns one row: dispatch + client-visit targets/actuals and conversion actuals. STABLE + SECURITY INVOKER so monthly_targets/actuals RLS applies; roster scoping is enforced by the _employee_ids array passed from getEmployeesForUser. Call twice (current + previous window) for period-over-period deltas. supabase.rpc(''get_dashboard_kpis'', {...}).';

-- Explicit execute grant (secure-by-default doctrine, matching 0019).
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(INT, INT, INT, INT, UUID[]) TO authenticated;

-- ============================================================================
-- DONE.
-- ============================================================================
