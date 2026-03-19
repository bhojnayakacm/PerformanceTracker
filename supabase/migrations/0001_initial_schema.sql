-- ============================================================================
-- 0001_initial_schema.sql
-- Employee Performance Tracker — Initial Database Schema
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- It creates all 4 tables, the auth trigger, and RLS policies in one shot.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
-- uuid-ossp is enabled by default on Supabase, but ensure it's there.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
-- Linked 1:1 with auth.users. Every signup auto-creates a profile row via trigger.
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer'
             CHECK (role IN ('super_admin', 'editor', 'viewer')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked 1:1 to auth.users. Role determines RLS access.';


-- ============================================================================
-- 2. EMPLOYEES TABLE
-- ============================================================================
CREATE TABLE public.employees (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emp_id     TEXT NOT NULL UNIQUE,            -- e.g. "ACM01157"
  name       TEXT NOT NULL,
  location   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.employees IS 'Master list of employees being tracked.';


-- ============================================================================
-- 3. MONTHLY TARGETS TABLE
-- ============================================================================
CREATE TABLE public.monthly_targets (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id              UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month                    SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                     SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),

  -- Meeting Targets
  target_total_meetings    INT NOT NULL DEFAULT 0,
  target_total_calls       INT NOT NULL DEFAULT 0,

  -- Performance Targets
  target_client_visits     INT NOT NULL DEFAULT 0,
  target_dispatched_sqft   INT NOT NULL DEFAULT 0,
  target_travelling_cities INT NOT NULL DEFAULT 0,   -- count of cities
  target_tour_days         INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, month, year)
);

COMMENT ON TABLE public.monthly_targets IS 'Per-employee monthly performance targets. One row per employee per month.';


-- ============================================================================
-- 4. MONTHLY ACTUALS TABLE
-- ============================================================================
CREATE TABLE public.monthly_actuals (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id               UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month                     SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                      SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),

  -- Meeting Actuals
  actual_calls              INT NOT NULL DEFAULT 0,
  actual_architect_meetings INT NOT NULL DEFAULT 0,
  actual_client_meetings    INT NOT NULL DEFAULT 0,
  actual_site_visits        INT NOT NULL DEFAULT 0,

  -- Performance Actuals
  actual_client_visits      INT NOT NULL DEFAULT 0,
  actual_dispatched_sqft    INT NOT NULL DEFAULT 0,
  actual_dispatched_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- no target counterpart
  actual_conversions        INT NOT NULL DEFAULT 0,              -- no target counterpart
  actual_tour_days          INT NOT NULL DEFAULT 0,

  -- Travelling Cities — stored as a TEXT array for flexible multi-city entry
  actual_travelling_cities  TEXT[] DEFAULT '{}',

  -- Costing Fields
  salary                    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tada                      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  incentive                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sales_promotion           NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- excluded from total_costing

  -- Generated Column: auto-calculated, cannot be written to directly
  total_costing             NUMERIC(12, 2) GENERATED ALWAYS AS (salary + tada + incentive) STORED,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, month, year)
);

COMMENT ON TABLE public.monthly_actuals IS 'Per-employee monthly actual performance data, costing, and city tracking.';
COMMENT ON COLUMN public.monthly_actuals.total_costing IS 'Auto-calculated: salary + tada + incentive. sales_promotion excluded.';
COMMENT ON COLUMN public.monthly_actuals.actual_travelling_cities IS 'Postgres TEXT[] array storing city names visited during the month.';


-- ============================================================================
-- 5. INDEXES (for common query patterns)
-- ============================================================================
CREATE INDEX idx_monthly_targets_employee   ON public.monthly_targets (employee_id);
CREATE INDEX idx_monthly_targets_period     ON public.monthly_targets (year, month);
CREATE INDEX idx_monthly_actuals_employee   ON public.monthly_actuals (employee_id);
CREATE INDEX idx_monthly_actuals_period     ON public.monthly_actuals (year, month);


-- ============================================================================
-- 6. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
-- Shared function that auto-updates the updated_at timestamp on any row change.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all 4 tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monthly_targets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monthly_actuals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 7. AUTH TRIGGER — Auto-create profile on signup
-- ============================================================================
-- When a new user signs up via Supabase Auth, this trigger fires and inserts
-- a row into public.profiles with role='viewer' (the safe default).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire AFTER INSERT on auth.users (Supabase's internal auth table)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Helper: get the current user's role from their profile.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ---------- Enable RLS on all tables ----------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_actuals ENABLE ROW LEVEL SECURITY;


-- ===================== PROFILES =====================

-- All authenticated users can read all profiles
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Super admins can insert profiles (manual user creation)
CREATE POLICY "profiles_insert_super_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Super admins can update any profile; users can update their own full_name
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'super_admin'
    OR id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    OR id = auth.uid()
  );

-- Super admins can delete profiles
CREATE POLICY "profiles_delete_super_admin"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ===================== EMPLOYEES =====================

-- All authenticated users can read employees
CREATE POLICY "employees_select"
  ON public.employees FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only super admins can create employees
CREATE POLICY "employees_insert_super_admin"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Only super admins can update employees
CREATE POLICY "employees_update_super_admin"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Only super admins can delete employees
CREATE POLICY "employees_delete_super_admin"
  ON public.employees FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ===================== MONTHLY TARGETS =====================

-- All authenticated users can read targets
CREATE POLICY "monthly_targets_select"
  ON public.monthly_targets FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only super admins can create targets
CREATE POLICY "monthly_targets_insert_super_admin"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Only super admins can update targets
CREATE POLICY "monthly_targets_update_super_admin"
  ON public.monthly_targets FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Only super admins can delete targets
CREATE POLICY "monthly_targets_delete_super_admin"
  ON public.monthly_targets FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ===================== MONTHLY ACTUALS =====================

-- All authenticated users can read actuals
CREATE POLICY "monthly_actuals_select"
  ON public.monthly_actuals FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only super admins can create actuals
CREATE POLICY "monthly_actuals_insert_super_admin"
  ON public.monthly_actuals FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Super admins and editors can update actuals
CREATE POLICY "monthly_actuals_update"
  ON public.monthly_actuals FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'editor'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'editor'));

-- Only super admins can delete actuals
CREATE POLICY "monthly_actuals_delete_super_admin"
  ON public.monthly_actuals FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ============================================================================
-- DONE. Schema, triggers, and RLS policies are ready.
-- ============================================================================
