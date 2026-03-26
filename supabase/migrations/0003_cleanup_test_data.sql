-- ============================================================================
-- 0003_cleanup_test_data.sql
-- One-time cleanup: wipe all test data from metrics tables
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor to clear old manually-entered
-- test data before starting fresh with the daily-metrics workflow.
--
-- Order matters: daily_metrics first (its trigger touches the monthly tables),
-- then monthly_actuals, then monthly_targets.
-- Employee master data and user profiles are NOT touched.
-- ============================================================================

-- 1. Daily metrics (new table — may already be empty)
DELETE FROM public.daily_metrics;

-- 2. Monthly actuals
DELETE FROM public.monthly_actuals;

-- 3. Monthly targets
DELETE FROM public.monthly_targets;
