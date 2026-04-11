-- ============================================================================
-- 0010_optimize_sync_trigger.sql
-- Optimize _sync_monthly_from_daily to use date-range predicate instead of
-- EXTRACT(), enabling the btree index on daily_metrics(employee_id, date).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._sync_monthly_from_daily(
  _employee_id UUID,
  _month       INT,
  _year        INT
) RETURNS VOID AS $$
DECLARE
  _start DATE;
  _end   DATE;
  _tc  INT;  -- sum target_calls
  _ttm INT;  -- sum target_total_meetings
  _ac  INT;  -- sum actual_calls
  _aam INT;  -- sum actual_architect_meetings
  _acm INT;  -- sum actual_client_meetings
  _asv INT;  -- sum actual_site_visits
BEGIN
  -- Build first-of-month and first-of-next-month for a sargable range scan.
  _start := make_date(_year, _month, 1);
  _end   := _start + INTERVAL '1 month';

  SELECT
    COALESCE(SUM(target_calls), 0),
    COALESCE(SUM(target_total_meetings), 0),
    COALESCE(SUM(actual_calls), 0),
    COALESCE(SUM(actual_architect_meetings), 0),
    COALESCE(SUM(actual_client_meetings), 0),
    COALESCE(SUM(actual_site_visits), 0)
  INTO _tc, _ttm, _ac, _aam, _acm, _asv
  FROM public.daily_metrics
  WHERE employee_id = _employee_id
    AND date >= _start
    AND date <  _end;

  -- Upsert monthly_targets
  INSERT INTO public.monthly_targets
    (employee_id, month, year, target_total_calls, target_total_meetings)
  VALUES
    (_employee_id, _month, _year, _tc, _ttm)
  ON CONFLICT (employee_id, month, year)
  DO UPDATE SET
    target_total_calls    = EXCLUDED.target_total_calls,
    target_total_meetings = EXCLUDED.target_total_meetings,
    updated_at            = NOW();

  -- Upsert monthly_actuals
  INSERT INTO public.monthly_actuals
    (employee_id, month, year, actual_calls, actual_architect_meetings, actual_client_meetings, actual_site_visits)
  VALUES
    (_employee_id, _month, _year, _ac, _aam, _acm, _asv)
  ON CONFLICT (employee_id, month, year)
  DO UPDATE SET
    actual_calls              = EXCLUDED.actual_calls,
    actual_architect_meetings = EXCLUDED.actual_architect_meetings,
    actual_client_meetings    = EXCLUDED.actual_client_meetings,
    actual_site_visits        = EXCLUDED.actual_site_visits,
    updated_at                = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
