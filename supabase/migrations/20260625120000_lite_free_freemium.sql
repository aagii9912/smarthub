-- ============================================
-- Lite plan → FREE freemium tier (хэрэглэгч татах)
-- ============================================
-- Background:
--   The Lite plan was ₮89,000/сар with 5,000 credits (5M tokens). To drive
--   user acquisition we make Lite a permanent FREE tier with a reduced quota
--   of 1,000 credits (1M tokens). Activation is instant — see
--   /api/subscription/subscribe, which now activates amount = 0 plans directly
--   instead of rejecting them.
--
--   This mirrors the in-code defaults in src/lib/ai/config/plans.ts:
--     price_monthly = 0, price_yearly = 0, tokens_per_month = 1,000,000.
--
-- Idempotent: re-running sets the same values (no-op). The `plans` row is
--   updated in place so its UUID/FKs (subscriptions.plan_id) are preserved.

UPDATE plans SET
    price_monthly = 0,
    price_yearly = 0,
    is_active = true,
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('messages_per_month', 1000, 'tokens_per_month', 1000000),
    limits = COALESCE(limits, '{}'::jsonb)
        || jsonb_build_object('max_messages', 1000, 'tokens_per_month', 1000000),
    updated_at = NOW()
WHERE slug = 'lite';
