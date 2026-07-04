-- ============================================================================
-- 0024_bulk_add_cities.sql
-- bulk_add_cities(_names) — populate the master City Pool from a raw list of
-- names in one atomic round-trip, skipping case-insensitive duplicates.
-- Powers the standalone "City Pool" bulk import on /import.
-- ============================================================================
-- WHY AN RPC
--   Doing this client-side (fetch pool → diff → insert) races a concurrent
--   admin and takes two round-trips. This function normalizes, de-dupes
--   (within the input AND against the existing pool, case-insensitively), and
--   inserts the genuinely-new names in a single statement, returning an
--   authoritative inserted/skipped breakdown the UI can trust.
--
-- NORMALIZATION
--   Trim + collapse internal whitespace; drop blanks; de-dupe the input
--   case-insensitively (first spelling wins). Casing is otherwise PRESERVED as
--   sent — the client title-cases before calling, mirroring the existing
--   importCityTours convention, so preview text == stored text.
--
-- DEDUPE vs the pool
--   cities.name is UNIQUE but case-SENSITIVE, so "Delhi" and "delhi" could both
--   exist. We match on lower(name) so a case-variant of an existing city is
--   skipped, not duplicated. ON CONFLICT (name) DO NOTHING additionally guards
--   the exact-spelling unique index against a concurrent insert.
--
-- SECURITY
--   SECURITY INVOKER (default): the INSERT runs as the caller, so the existing
--   cities_insert RLS policy (super_admin only, migration 0008) is enforced.
--   The server action also asserts super_admin — defense in depth. Explicit
--   GRANT EXECUTE per the secure-by-default doctrine (0019/0020).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_add_cities(_names TEXT[])
RETURNS TABLE (
  inserted_count INT,
  skipped_count  INT,
  inserted_names TEXT[],
  skipped_names  TEXT[]
)
LANGUAGE sql
AS $$
  WITH cleaned AS (
    -- Trim + collapse whitespace, drop blanks, de-dupe case-insensitively.
    SELECT DISTINCT ON (lower(btrim(regexp_replace(n, '\s+', ' ', 'g'))))
           btrim(regexp_replace(n, '\s+', ' ', 'g')) AS name
    FROM unnest(_names) AS n
    WHERE btrim(coalesce(n, '')) <> ''
    ORDER BY
      lower(btrim(regexp_replace(n, '\s+', ' ', 'g'))),
      btrim(regexp_replace(n, '\s+', ' ', 'g'))
  ),
  existing AS (
    SELECT c.name
    FROM cleaned c
    WHERE EXISTS (
      SELECT 1 FROM public.cities ci WHERE lower(ci.name) = lower(c.name)
    )
  ),
  ins AS (
    INSERT INTO public.cities (name)
    SELECT c.name
    FROM cleaned c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cities ci WHERE lower(ci.name) = lower(c.name)
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING name
  )
  -- Reference the data-modifying CTE exactly once (aggregate count + names in
  -- a single scan) so the INSERT is unambiguously executed once.
  SELECT
    COALESCE(i.cnt, 0),
    COALESCE(e.cnt, 0),
    COALESCE(i.names, ARRAY[]::TEXT[]),
    COALESCE(e.names, ARRAY[]::TEXT[])
  FROM
    (SELECT count(*)::INT AS cnt, array_agg(name ORDER BY name) AS names FROM ins) i,
    (SELECT count(*)::INT AS cnt, array_agg(name ORDER BY name) AS names FROM existing) e;
$$;

COMMENT ON FUNCTION public.bulk_add_cities(TEXT[]) IS
  'Bulk-insert cities into the master pool from a raw name array. Normalizes + de-dupes case-insensitively (within input and against the pool), inserts only new names, and returns (inserted_count, skipped_count, inserted_names, skipped_names). SECURITY INVOKER so the cities_insert super_admin RLS policy applies. supabase.rpc(''bulk_add_cities'', { _names }).';

GRANT EXECUTE ON FUNCTION public.bulk_add_cities(TEXT[]) TO authenticated;

-- ============================================================================
-- DONE.
-- ============================================================================
