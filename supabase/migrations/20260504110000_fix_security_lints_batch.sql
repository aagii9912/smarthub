-- ============================================================
-- Supabase Database Linter — batch fix
-- ============================================================
-- Addresses these advisories:
--   * 0011 function_search_path_mutable
--       - public.increment_user_token_pool
--       - public.reset_user_token_pool_if_due
--   * 0024 rls_policy_always_true
--       - public.payment_audit_logs   "Service role full access to audit logs"
--       - public.leads                "Anyone can insert leads"
--   * 0028 anon_security_definer_function_executable
--   * 0029 authenticated_security_definer_function_executable
--       - public.cleanup_stale_push_subscriptions()
--       - public.increment_push_failure_count(uuid)
--       - public.increment_user_token_pool(uuid, uuid, bigint, text)
--       - public.reset_user_token_pool_if_due(uuid)
--
-- The five RLS-helper SECURITY DEFINER functions
-- (get_user_shop_id, get_user_shop_ids, is_current_user_admin,
--  is_service_role, user_owns_shop) are intentionally left callable by
-- authenticated — Postgres evaluates RLS policy expressions as the calling
-- user, so revoking EXECUTE would break every policy that references them.
-- The right long-term fix is to move them to a non-`public` schema, which is
-- a larger refactor tracked separately.
--
-- The auth_leaked_password_protection lint is a Supabase Auth dashboard
-- toggle (Authentication → Providers → Email → "Enable leaked password
-- protection") and cannot be fixed via migration. See verification notes.
-- ============================================================


-- ─── 1. Lint 0011: pin search_path on the two flagged functions ───
ALTER FUNCTION public.increment_user_token_pool(uuid, uuid, bigint, text)
    SET search_path = public;

ALTER FUNCTION public.reset_user_token_pool_if_due(uuid)
    SET search_path = public;


-- ─── 2. Lint 0028 / 0029: lock down service-role-only RPCs ───
-- These four are called only from server code via `supabaseAdmin()`
-- (service role bypasses these grants). Postgres grants EXECUTE to PUBLIC
-- by default on CREATE FUNCTION; the original migrations only added a
-- service_role GRANT on top, so anon/authenticated kept the default
-- access and PostgREST exposes them under /rest/v1/rpc/.

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_push_subscriptions()
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_push_failure_count(uuid)
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_user_token_pool(uuid, uuid, bigint, text)
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_user_token_pool_if_due(uuid)
    FROM PUBLIC, anon, authenticated;

-- Re-assert the service_role grant so this migration is idempotent regardless
-- of whether it runs before or after a fresh deploy of the source migrations.
GRANT EXECUTE ON FUNCTION public.cleanup_stale_push_subscriptions()                            TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_push_failure_count(uuid)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_token_pool(uuid, uuid, bigint, text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_token_pool_if_due(uuid)                            TO service_role;


-- ─── 3. Lint 0024: payment_audit_logs — drop redundant always-true policy ───
-- `service_role` bypasses RLS by design, so a `FOR ALL USING(true) WITH CHECK(true)`
-- policy with no role restriction effectively grants every authenticated/anon
-- caller full read+write. The existing "Shop owners can view own audit logs"
-- SELECT policy plus service-role bypass is the correct posture.
DROP POLICY IF EXISTS "Service role full access to audit logs" ON public.payment_audit_logs;


-- ─── 4. Lint 0024: leads — replace WITH CHECK (true) with content guard ───
-- The lead-capture form is intentionally open to anon, but an unconditional
-- `WITH CHECK (true)` trips the linter and would also let empty/whitespace
-- rows through. Re-create the policy with a real predicate that mirrors what
-- the API route already enforces (name + phone non-empty).
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

CREATE POLICY "Anyone can insert leads"
    ON public.leads FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(btrim(coalesce(name,  ''))) > 0
        AND length(btrim(coalesce(phone, ''))) > 0
    );
