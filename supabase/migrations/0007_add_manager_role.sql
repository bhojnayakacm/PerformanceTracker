-- ============================================================================
-- 0007_add_manager_role.sql
-- Add "manager" role and manager_assignments junction table
-- ============================================================================
-- A manager has the same editing permissions as super_admin (targets + actuals)
-- but can only view/edit employees assigned to them via manager_assignments.
-- ============================================================================


-- ============================================================================
-- 1. UPDATE ROLE CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'manager', 'editor', 'viewer'));


-- ============================================================================
-- 2. MANAGER_ASSIGNMENTS JUNCTION TABLE
-- ============================================================================
CREATE TABLE public.manager_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (manager_id, employee_id)
);

COMMENT ON TABLE public.manager_assignments
  IS 'Maps managers to the employees they can view and edit. Super admins manage these assignments.';

CREATE INDEX idx_manager_assignments_manager  ON public.manager_assignments (manager_id);
CREATE INDEX idx_manager_assignments_employee ON public.manager_assignments (employee_id);


-- ============================================================================
-- 3. RLS FOR MANAGER_ASSIGNMENTS
-- ============================================================================
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins can read all assignments; managers can read their own
CREATE POLICY "manager_assignments_select"
  ON public.manager_assignments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'super_admin'
    OR manager_id = auth.uid()
  );

-- Only super admins can create assignments
CREATE POLICY "manager_assignments_insert"
  ON public.manager_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Only super admins can delete assignments
CREATE POLICY "manager_assignments_delete"
  ON public.manager_assignments FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ============================================================================
-- 4. UPDATE EXISTING RLS POLICIES TO INCLUDE MANAGER
-- ============================================================================

-- ── daily_metrics: add 'manager' alongside super_admin/editor ──
DROP POLICY IF EXISTS "daily_metrics_insert_admin_editor" ON public.daily_metrics;
DROP POLICY IF EXISTS "daily_metrics_insert" ON public.daily_metrics;
CREATE POLICY "daily_metrics_insert"
  ON public.daily_metrics FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

DROP POLICY IF EXISTS "daily_metrics_update_admin_editor" ON public.daily_metrics;
DROP POLICY IF EXISTS "daily_metrics_update" ON public.daily_metrics;
CREATE POLICY "daily_metrics_update"
  ON public.daily_metrics FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager', 'editor'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

DROP POLICY IF EXISTS "daily_metrics_delete_admin_editor" ON public.daily_metrics;
DROP POLICY IF EXISTS "daily_metrics_delete" ON public.daily_metrics;
CREATE POLICY "daily_metrics_delete"
  ON public.daily_metrics FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

-- ── monthly_targets: add 'manager' alongside super_admin ──
DROP POLICY IF EXISTS "monthly_targets_insert_super_admin" ON public.monthly_targets;
DROP POLICY IF EXISTS "monthly_targets_insert" ON public.monthly_targets;
CREATE POLICY "monthly_targets_insert"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager'));

DROP POLICY IF EXISTS "monthly_targets_update_super_admin" ON public.monthly_targets;
DROP POLICY IF EXISTS "monthly_targets_update" ON public.monthly_targets;
CREATE POLICY "monthly_targets_update"
  ON public.monthly_targets FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager'));

-- ── monthly_actuals: add 'manager' to insert and update ──
DROP POLICY IF EXISTS "monthly_actuals_insert_super_admin" ON public.monthly_actuals;
DROP POLICY IF EXISTS "monthly_actuals_insert" ON public.monthly_actuals;
CREATE POLICY "monthly_actuals_insert"
  ON public.monthly_actuals FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));

DROP POLICY IF EXISTS "monthly_actuals_update" ON public.monthly_actuals;
CREATE POLICY "monthly_actuals_update"
  ON public.monthly_actuals FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'manager', 'editor'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'manager', 'editor'));


-- ============================================================================
-- DONE. Manager role, junction table, and updated RLS policies are ready.
-- ============================================================================
