-- ============================================================
-- Supabase Database Linter — final cleanup
-- ============================================================
-- Follow-up to 20260504110000_fix_security_lints_batch.sql.
-- Addresses the remaining 5 of 6 advisory warnings; the 6th
-- (auth_leaked_password_protection) is a Supabase Auth dashboard
-- toggle and CANNOT be fixed via migration. See bottom of file.
--
-- Lints addressed (all five are SECURITY DEFINER helpers exposed
-- in the public schema and callable by authenticated/anon via
-- /rest/v1/rpc/, triggering lint 0028 and/or 0029):
--   - public.get_user_shop_id()           [move to `private`]
--   - public.get_user_shop_ids()          [move to `private`]
--   - public.is_current_user_admin()      [move to `private`]
--   - public.is_service_role()            [move to `private`]
--   - public.user_owns_shop(uuid)         [move to `private`]
--
-- All five are RLS-helper functions used inside policy expressions
-- on production (e.g. `service_role_all_products` on `products`
-- references `is_service_role()`). None are .rpc()-called from app
-- code (verified by grep across *.ts / *.tsx). Moving them out of
-- `public` removes them from PostgREST's auto-exposed schema list
-- (default db.schemas = ["public", "graphql_public"]) without
-- breaking any policy: Postgres stores RLS policy expressions as
-- parse trees that reference functions by OID, and `ALTER FUNCTION
-- ... SET SCHEMA` preserves the OID, so every dependent policy
-- continues to evaluate correctly with zero rewrites.
--
-- IMPORTANT: an earlier draft of this migration tried to DROP four
-- of these functions (the ones with no migration definition in repo)
-- on the assumption they were orphan drift with no callers — true in
-- the *repo* but FALSE on production, where un-committed RLS
-- policies (e.g. service_role_all_products, service_role_all_orders)
-- reference them. The DROP failed with 2BP01 "dependent objects
-- still exist". The SET SCHEMA approach below side-steps that whole
-- class of issue.
-- ============================================================


-- ─── 1. Create the `private` schema for non-PostgREST helpers ───
CREATE SCHEMA IF NOT EXISTS private;

-- Lock the schema down. Service role and the function owner need
-- USAGE; anon/authenticated do NOT — these helpers are invoked
-- inside SECURITY DEFINER bodies, which bypass caller-role schema
-- USAGE checks for the duration of the call.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;


-- ─── 2. Move the five RLS-helper functions out of public ───
-- ALTER FUNCTION ... SET SCHEMA preserves the function OID, which
-- is what pg_depend / RLS policies actually reference. After this
-- runs, existing policies continue to evaluate the same function
-- without any modification; PostgREST stops auto-exposing them
-- because `private` isn't in db.schemas.
--
-- We iterate in a DO block (rather than five plain ALTER statements)
-- because ALTER FUNCTION does NOT support IF EXISTS — so on a fresh
-- dev DB where some helpers were never created, plain statements
-- would error. The pg_proc filter makes this idempotent: only
-- functions that currently live in `public` get moved.

DO $move$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'get_user_shop_id',
              'get_user_shop_ids',
              'is_current_user_admin',
              'is_service_role',
              'user_owns_shop'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET SCHEMA private',
            fn.proname, fn.args
        );
    END LOOP;
END
$move$;


-- ─── 3. Tighten EXECUTE grants on the moved functions ───────────
-- Defense in depth: the schema USAGE revoke above already prevents
-- anon/authenticated from reaching these functions, but we also
-- revoke EXECUTE so qualified-name calls would fail loudly even if
-- a future change to db.schemas exposed `private`.

DO $grants$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'private'
          AND p.proname IN (
              'get_user_shop_id',
              'get_user_shop_ids',
              'is_current_user_admin',
              'is_service_role',
              'user_owns_shop'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION private.%I(%s) FROM PUBLIC, anon, authenticated',
            fn.proname, fn.args
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION private.%I(%s) TO postgres, service_role',
            fn.proname, fn.args
        );
    END LOOP;
END
$grants$;


-- ─── 4. Documentation: auth_leaked_password_protection ─────────
-- This advisory cannot be resolved via SQL/migration. Resolve it
-- in the Supabase Dashboard:
--   Authentication → Providers → Email → "Enable leaked password
--   protection" (toggle ON). This enables Supabase's HaveIBeenPwned
--   integration on signup and password reset.
