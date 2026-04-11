-- Performance indexes for search and query optimization.
-- These complement existing unique/PK indexes and speed up the most
-- common access patterns: employee search, date lookups, period filters.

-- ═══════════════════════════════════════════════════════════════
-- 1. Trigram indexes for fast ILIKE '%term%' substring searches
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_employees_name_trgm
  ON employees USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_employees_emp_id_trgm
  ON employees USING gin (emp_id gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════
-- 2. Partial index: active employees (most common filter)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employees_active
  ON employees (name) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- 3. Daily metrics: date and composite employee+date lookups
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date
  ON daily_metrics (date);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_employee_date
  ON daily_metrics (employee_id, date);

-- ═══════════════════════════════════════════════════════════════
-- 4. Monthly tables: period (month, year) composite lookups
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_monthly_targets_period
  ON monthly_targets (month, year);

CREATE INDEX IF NOT EXISTS idx_monthly_actuals_period
  ON monthly_actuals (month, year);

CREATE INDEX IF NOT EXISTS idx_monthly_city_tours_period
  ON monthly_city_tours (month, year);

-- ═══════════════════════════════════════════════════════════════
-- 5. Manager assignments: fast role-scoped employee lookups
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager
  ON manager_assignments (manager_id);
