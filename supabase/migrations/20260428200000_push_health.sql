-- ============================================
-- PUSH SUBSCRIPTION HEALTH (Issue #4)
-- ============================================
-- A push_subscriptions row can outlive the browser that created it
-- (uninstall, cleared site data, expired permission). When that happens,
-- web-push throws non-410 errors that we can't always classify, so the row
-- lingers and `sendPushNotification` reports zero successful deliveries
-- without surfacing the problem.
--
-- This migration adds two health columns and a small RPC that the runtime
-- uses to track failures, plus a cleanup helper the cron can call.
-- ============================================

ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_health
    ON push_subscriptions(failure_count, last_used_at);

-- Atomically bump the failure counter for a single subscription.
-- Idempotent: returns the new failure_count.
CREATE OR REPLACE FUNCTION increment_push_failure_count(p_subscription_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.push_subscriptions
    SET failure_count = COALESCE(failure_count, 0) + 1
    WHERE id = p_subscription_id
    RETURNING failure_count INTO new_count;

    RETURN COALESCE(new_count, 0);
END;
$$;

-- Reap subscriptions that have either failed too many times or sat unused
-- for two weeks. Returns the number of rows deleted.
CREATE OR REPLACE FUNCTION cleanup_stale_push_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted INTEGER;
BEGIN
    WITH gone AS (
        DELETE FROM public.push_subscriptions
        WHERE failure_count >= 3
           OR (last_used_at IS NOT NULL AND last_used_at < NOW() - INTERVAL '14 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted FROM gone;
    RETURN deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_push_failure_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stale_push_subscriptions() TO service_role;
