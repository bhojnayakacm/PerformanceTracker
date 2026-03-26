-- ============================================================================
-- 0002_add_daily_metrics.sql
-- Daily Metrics: Granular date-wise tracking for Meetings & Calls
-- ============================================================================
-- Adds the daily_metrics table, a Postgres trigger that auto-syncs daily sums
-- into monthly_targets and monthly_actuals, and RLS policies.
--
-- After this migration, the 4 "Meetings & Calls" metrics (calls, architect
-- meetings, client meetings, site visits) are entered daily. A trigger rolls
-- them up into the existing monthly tables so Dashboard, Reports, and all
-- other consumers continue to work with zero changes.
-- ============================================================================


-- ============================================================================
-- 1. DAILY_METRICS TABLE
-- ============================================================================
CREATE TABLE public.daily_metrics (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id               UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date                      DATE NOT NULL,

  -- Daily Targets (set by super_admin)
  target_calls              INT NOT NULL DEFAULT 0,
  target_architect_meetings INT NOT NULL DEFAULT 0,
  target_client_meetings    INT NOT NULL DEFAULT 0,
  target_site_visits        INT NOT NULL DEFAULT 0,

  -- Daily Actuals (entered by editor / super_admin)
  actual_calls              INT NOT NULL DEFAULT 0,
  actual_architect_meetings INT NOT NULL DEFAULT 0,
  actual_client_meetings    INT NOT NULL DEFAULT 0,
  actual_site_visits        INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, date)
);

COMMENT ON TABLE public.daily_metrics
  IS 'Per-employee daily targets and actuals for Meetings & Calls. Trigger auto-syncs sums into monthly tables.';


-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX idx_daily_metrics_employee ON public.daily_metrics (employee_id);
CREATE INDEX idx_daily_metrics_date     ON public.daily_metrics (date);
CREATE INDEX idx_daily_metrics_emp_date ON public.daily_metrics (employee_id, date);


-- ============================================================================
-- 3. UPDATED_AT TRIGGER (reuses existing handle_updated_at function)
-- ============================================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 4. SYNC HELPER — Recompute monthly totals for one employee + month + year
-- ============================================================================
-- SECURITY DEFINER so it can upsert into monthly_targets (which editors
-- normally cannot write to) when an editor's daily_metrics change fires it.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._sync_monthly_from_daily(
  _employee_id UUID,
  _month       INT,
  _year        INT
) RETURNS VOID AS $$
DECLARE
  _tc  INT;  -- sum target_calls
  _tam INT;  -- sum target_architect_meetings
  _tcm INT;  -- sum target_client_meetings
  _tsv INT;  -- sum target_site_visits
  _ac  INT;  -- sum actual_calls
  _aam INT;  -- sum actual_architect_meetings
  _acm INT;  -- sum actual_client_meetings
  _asv INT;  -- sum actual_site_visits
BEGIN
  -- Aggregate all daily rows for this employee in the given month/year
  SELECT
    COALESCE(SUM(target_calls), 0),
    COALESCE(SUM(target_architect_meetings), 0),
    COALESCE(SUM(target_client_meetings), 0),
    COALESCE(SUM(target_site_visits), 0),
    COALESCE(SUM(actual_calls), 0),
    COALESCE(SUM(actual_architect_meetings), 0),
    COALESCE(SUM(actual_client_meetings), 0),
    COALESCE(SUM(actual_site_visits), 0)
  INTO _tc, _tam, _tcm, _tsv, _ac, _aam, _acm, _asv
  FROM public.daily_metrics
  WHERE employee_id = _employee_id
    AND EXTRACT(MONTH FROM date) = _month
    AND EXTRACT(YEAR  FROM date) = _year;

  -- Upsert monthly_targets (only the two daily-tracked target columns)
  INSERT INTO public.monthly_targets
    (employee_id, month, year, target_total_calls, target_total_meetings)
  VALUES
    (_employee_id, _month, _year, _tc, _tam + _tcm + _tsv)
  ON CONFLICT (employee_id, month, year)
  DO UPDATE SET
    target_total_calls    = EXCLUDED.target_total_calls,
    target_total_meetings = EXCLUDED.target_total_meetings,
    updated_at            = NOW();

  -- Upsert monthly_actuals (only the four daily-tracked actual columns)
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


-- ============================================================================
-- 5. TRIGGER FUNCTION — Dispatch sync on every daily_metrics change
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_daily_to_monthly()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE, sync the NEW row's month
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public._sync_monthly_from_daily(
      NEW.employee_id,
      EXTRACT(MONTH FROM NEW.date)::INT,
      EXTRACT(YEAR  FROM NEW.date)::INT
    );
  END IF;

  -- On DELETE, sync the OLD row's month
  IF TG_OP = 'DELETE' THEN
    PERFORM public._sync_monthly_from_daily(
      OLD.employee_id,
      EXTRACT(MONTH FROM OLD.date)::INT,
      EXTRACT(YEAR  FROM OLD.date)::INT
    );

  -- On UPDATE, if the employee or month/year changed, also re-sync the OLD combination
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.employee_id != NEW.employee_id
       OR EXTRACT(MONTH FROM OLD.date) != EXTRACT(MONTH FROM NEW.date)
       OR EXTRACT(YEAR  FROM OLD.date) != EXTRACT(YEAR  FROM NEW.date)
    THEN
      PERFORM public._sync_monthly_from_daily(
        OLD.employee_id,
        EXTRACT(MONTH FROM OLD.date)::INT,
        EXTRACT(YEAR  FROM OLD.date)::INT
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 6. ATTACH TRIGGER
-- ============================================================================
CREATE TRIGGER trg_sync_daily_to_monthly
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_daily_to_monthly();


-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read daily metrics
CREATE POLICY "daily_metrics_select"
  ON public.daily_metrics FOR SELECT
  TO authenticated
  USING (TRUE);

-- Super admins and editors can insert daily metrics
CREATE POLICY "daily_metrics_insert_admin_editor"
  ON public.daily_metrics FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'editor'));

-- Super admins and editors can update daily metrics
CREATE POLICY "daily_metrics_update_admin_editor"
  ON public.daily_metrics FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'editor'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'editor'));

-- Super admins and editors can delete daily metrics
CREATE POLICY "daily_metrics_delete_admin_editor"
  ON public.daily_metrics FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'editor'));


-- ============================================================================
-- DONE. Daily metrics table, sync trigger, and RLS policies are ready.
-- ============================================================================
