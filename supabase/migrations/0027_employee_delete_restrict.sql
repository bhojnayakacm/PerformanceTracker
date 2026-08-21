-- ============================================================================
-- 0027_employee_delete_restrict.sql
-- Stop a hard-delete of an employee from silently destroying their history.
-- ============================================================================
-- THE PROBLEM
--   Every child table was created with its employee FK as ON DELETE CASCADE:
--     monthly_targets, monthly_actuals   (0001)
--     daily_metrics                      (0002)
--     manager_assignments                (0007)
--     monthly_city_tours                 (0008)
--   That was a sensible default when nothing could delete an employee. Now
--   that the Employees page offers a Delete action, it is actively dangerous:
--   `DELETE FROM employees` raises NO foreign-key error and instead takes
--   years of daily logs, targets, actuals and city tours down with it —
--   irreversibly, and with no warning to the operator.
--
-- THE CHANGE
--   Flip those five constraints to ON DELETE RESTRICT. Postgres then refuses
--   the delete with SQLSTATE 23503 whenever any history exists, which is what
--   deleteEmployee() surfaces as "…has existing performance records. Please
--   Deactivate them instead." Employees with no history (created by mistake)
--   still delete cleanly.
--
--   The app also counts dependencies before deleting, so the guard works even
--   without this migration. This migration is what closes the race between
--   that count and the DELETE, and makes the rule true for any future caller
--   that bypasses the server action.
--
-- NOT CHANGED
--   employees.reporting_manager_id (0016) stays ON DELETE SET NULL. Nulling a
--   manager link is recoverable, unlike losing performance rows, and the
--   server action already blocks deleting anyone who still has direct reports.
--
-- SAFETY
--   Idempotent: the lookup only matches constraints still set to CASCADE
--   ('c'), so re-running is a no-op. Constraint names are read from the
--   catalog rather than assumed, so a non-default name is handled correctly.
--   No data is read or written — this only alters constraint definitions.
-- ============================================================================

DO $$
DECLARE
  target_table TEXT;
  con RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'monthly_targets',
    'monthly_actuals',
    'daily_metrics',
    'manager_assignments',
    'monthly_city_tours'
  ]
  LOOP
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class      rel  ON rel.oid  = c.conrelid
      JOIN pg_namespace  n    ON n.oid    = rel.relnamespace
      JOIN pg_class      fref ON fref.oid = c.confrelid
      WHERE n.nspname    = 'public'
        AND rel.relname  = target_table
        AND c.contype    = 'f'
        AND fref.relname = 'employees'
        AND c.confdeltype = 'c'   -- 'c' = CASCADE; skip anything already fixed
    LOOP
      RAISE NOTICE 'Converting %.% to ON DELETE RESTRICT', target_table, con.conname;

      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT %I',
        target_table, con.conname
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I '
        'FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT',
        target_table, con.conname
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- Verify (should report 'r' for all five):
--   SELECT rel.relname, c.conname, c.confdeltype
--   FROM pg_constraint c
--   JOIN pg_class rel ON rel.oid = c.conrelid
--   JOIN pg_class fref ON fref.oid = c.confrelid
--   WHERE c.contype = 'f' AND fref.relname = 'employees';
-- ============================================================================
