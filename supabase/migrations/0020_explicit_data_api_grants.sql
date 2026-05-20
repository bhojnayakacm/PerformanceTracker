-- ============================================================================
-- 0020_explicit_data_api_grants.sql
-- Explicit Data API privileges — end reliance on Supabase auto-exposure
-- ============================================================================
-- BACKGROUND
--   The Supabase Data API (PostgREST) only exposes a table to a role when that
--   role holds Postgres table privileges (SELECT / INSERT / UPDATE / DELETE).
--   Row Level Security then filters rows ON TOP of those privileges — RLS by
--   itself is not enough; the underlying GRANT must exist or PostgREST returns
--   a permission error before any policy is ever evaluated.
--
--   Migrations 0001–0018 created 8 tables but never wrote a single table-level
--   GRANT. They have worked only because Supabase's project bootstrap installs
--   `ALTER DEFAULT PRIVILEGES` rules that auto-grant ALL on every new public
--   table to anon / authenticated / service_role. That is implicit,
--   environment-dependent behaviour: a project with new-table auto-exposure
--   disabled — or any `supabase db reset` / fresh-project rebuild that runs
--   these migrations without that bootstrap — would create these tables with
--   NO grants, and every Data API call would fail at the privilege check.
--
--   This migration makes the privilege model explicit and self-contained, so
--   the schema reproduces identically regardless of the project's
--   auto-exposure setting. It is the table-level counterpart to the explicit
--   `GRANT EXECUTE` that migration 0019 already applied to get_monthly_mtd().
--
-- IDEMPOTENCY
--   GRANT and REVOKE are naturally idempotent — re-applying an existing grant
--   (or revoking an absent one) is a no-op and never raises an error. This
--   file is safe to run any number of times.
--
-- ROLE POLICY
--   authenticated  → granted. Every RLS policy in this schema targets
--                    `authenticated`; it is the app's only Data-API role.
--   service_role   → granted. Used by server-side admin paths. Included so a
--                    fresh rebuild keeps working without the bootstrap magic.
--   anon           → NOT granted, and actively revoked in section 3. There is
--                    not a single `TO anon` RLS policy in this schema, so anon
--                    cannot read a row today — but if it still carries the
--                    bootstrap's auto-grant, a future stray anon policy would
--                    instantly leak data. Revoking closes that latent hole.
-- ============================================================================


-- ============================================================================
-- 1. SCHEMA USAGE
-- ============================================================================
-- A role cannot reach any object in `public` without USAGE on the schema.
-- Postgres grants this to PUBLIC by default; re-stated here so the migration
-- is fully self-contained on a locked-down or non-Supabase target.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;


-- ============================================================================
-- 2. TABLE PRIVILEGES  (authenticated + service_role)
-- ============================================================================
-- All 8 application tables. RLS — enabled in 0001 / 0002 / 0007 / 0008 — stays
-- the row-level gate; these grants are the table-level prerequisite that the
-- Data API checks first.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles            TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_targets     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_actuals     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_metrics       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities              TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_city_tours  TO authenticated, service_role;

-- NOTE — no sequence grants are needed: every primary key is a UUID produced
-- by uuid_generate_v4(), and monthly_actuals.total_costing is a GENERATED
-- column. There is not a single SERIAL / sequence-backed column in this schema.
--
-- NOTE — the only API-exposed FUNCTION, public.get_monthly_mtd(INT, INT),
-- already received an explicit `GRANT EXECUTE ... TO authenticated` in
-- migration 0019, so it is intentionally not repeated here.


-- ============================================================================
-- 3. HARDENING — revoke stale auto-exposure grants from `anon`
-- ============================================================================
-- Surgical: table privileges only. We deliberately do NOT revoke schema USAGE
-- from anon — Supabase internals and the unauthenticated auth flow rely on it.
-- Safe because no `TO anon` RLS policy exists anywhere in this schema: anon
-- already cannot read a row, so this purely removes the tables from anon's
-- Data API surface. Drop this section if you have a deliberate anon use case.
REVOKE ALL ON public.profiles            FROM anon;
REVOKE ALL ON public.employees           FROM anon;
REVOKE ALL ON public.monthly_targets     FROM anon;
REVOKE ALL ON public.monthly_actuals     FROM anon;
REVOKE ALL ON public.daily_metrics       FROM anon;
REVOKE ALL ON public.manager_assignments FROM anon;
REVOKE ALL ON public.cities              FROM anon;
REVOKE ALL ON public.monthly_city_tours  FROM anon;


-- ============================================================================
-- DONE. The 8 application tables are now explicitly exposed to authenticated
-- (and service_role) and explicitly hidden from anon — independent of any
-- project-level auto-exposure setting.
-- ============================================================================
