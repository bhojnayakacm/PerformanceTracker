-- ============================================================================
-- 0021_add_hotel_and_vendor_fields.sql
-- Net Sale Breakdown + Costing changes (management feedback).
--   1. Rename  actual_project → actual_commercial_project.
--   2. Add     actual_hotel_project  (INT)            to the Net Sale Breakdown.
--   3. Add     actual_vendor_costing (NUMERIC(12,2))  to the Costing section.
--   4. Re-derive the generated columns to fold in the new fields.
-- ============================================================================
-- WHY THE DROP / RE-ADD DANCE
-- ---------------------------
-- actual_net_sale and actual_dispatched_sqft are STORED GENERATED columns whose
-- expressions reference actual_project, and a GENERATED expression is immutable
-- once created (you cannot ALTER the formula in place). Because we must change
-- BOTH formulas anyway — to add actual_hotel_project — the clean, dependency-safe
-- path is:
--     drop generated cols  →  rename raw col  →  add new raw cols  →  recreate
--     generated cols.
-- total_costing is likewise GENERATED; we drop & recreate it to fold in
-- actual_vendor_costing.
--
-- Existing rows get actual_hotel_project = 0 and actual_vendor_costing = 0, so
-- actual_net_sale / actual_dispatched_sqft / total_costing are UNCHANGED for all
-- historical data — the recompute is value-preserving for prior months.
--
-- DATA API / RLS
-- --------------
-- The table-level GRANT on monthly_actuals (migration 0020) already covers every
-- column, new ones included — column privileges follow the table grant, so no
-- new GRANT/REVOKE is required. get_monthly_mtd() (0019) references only the
-- daily-grain meeting/call columns, so the MTD RPC is unaffected by this change.
-- ============================================================================


-- ============================================================================
-- 1. Drop the generated columns that depend on actual_project / need re-deriving
-- ============================================================================
ALTER TABLE public.monthly_actuals
  DROP COLUMN IF EXISTS actual_dispatched_sqft,
  DROP COLUMN IF EXISTS actual_net_sale;


-- ============================================================================
-- 2. Rename actual_project → actual_commercial_project
-- ============================================================================
ALTER TABLE public.monthly_actuals
  RENAME COLUMN actual_project TO actual_commercial_project;


-- ============================================================================
-- 3. Add the new raw input columns
-- ============================================================================
ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_hotel_project  INT           NOT NULL DEFAULT 0,
  ADD COLUMN actual_vendor_costing NUMERIC(12, 2) NOT NULL DEFAULT 0;


-- ============================================================================
-- 4. Recreate the dispatched generated columns, now folding in hotel_project.
--    (PG generated cols can't reference each other, so dispatched expands the
--     net-sale terms inline + return, mirroring migration 0008.)
-- ============================================================================
ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_net_sale INT
    GENERATED ALWAYS AS (
      actual_project_2 + actual_commercial_project + actual_hotel_project
        + actual_tile + actual_retail
    ) STORED;

ALTER TABLE public.monthly_actuals
  ADD COLUMN actual_dispatched_sqft INT
    GENERATED ALWAYS AS (
      actual_project_2 + actual_commercial_project + actual_hotel_project
        + actual_tile + actual_retail + actual_return
    ) STORED;


-- ============================================================================
-- 5. Recreate total_costing to include vendor costing.
--    salary + tada + incentive + vendor_costing; sales_promotion stays excluded.
-- ============================================================================
ALTER TABLE public.monthly_actuals
  DROP COLUMN IF EXISTS total_costing;

ALTER TABLE public.monthly_actuals
  ADD COLUMN total_costing NUMERIC(12, 2)
    GENERATED ALWAYS AS (salary + tada + incentive + actual_vendor_costing) STORED;


-- ============================================================================
-- 6. Refresh column comments
-- ============================================================================
COMMENT ON COLUMN public.monthly_actuals.actual_commercial_project IS 'Commercial Project dispatch (sqft). Renamed from actual_project in 0021.';
COMMENT ON COLUMN public.monthly_actuals.actual_hotel_project      IS 'Hotel Project dispatch (sqft). Part of Net Sale. Added in 0021.';
COMMENT ON COLUMN public.monthly_actuals.actual_vendor_costing     IS 'Vendor costing (INR). Included in total_costing. Added in 0021.';
COMMENT ON COLUMN public.monthly_actuals.actual_net_sale           IS 'Auto-calculated: project_2 + commercial_project + hotel_project + tile + retail.';
COMMENT ON COLUMN public.monthly_actuals.actual_dispatched_sqft    IS 'Auto-calculated: net_sale + return.';
COMMENT ON COLUMN public.monthly_actuals.total_costing             IS 'Auto-calculated: salary + tada + incentive + vendor_costing. sales_promotion excluded.';


-- ============================================================================
-- DONE. monthly_actuals now tracks commercial vs hotel project dispatch and
-- vendor costing; all three generated columns reflect the new fields.
-- ============================================================================
