-- Reconcile plan slug drift + stale plan metadata.
--
-- 1. 009_add_subscription_system.sql seeds slug 'professional', but
--    20260427100000_three_day_trial_and_quotas.sql updates WHERE slug = 'pro',
--    so a seeded 'professional' row never received tokens_per_month quotas.
-- 2. 20260119140000_expand_features.sql wrote features.ai_model values of
--    'gpt-4o' / 'gpt-4o-mini' — the stack is Gemini-only (see
--    src/lib/ai/config/plans.ts).
-- 3. The seeded 'free' plan is dead: /api/subscription/subscribe rejects
--    amount = 0, so nobody can ever activate it.
--
-- All statements are guarded so the migration is idempotent and safe on any
-- environment (rows missing → no-op, already-fixed rows → no-op).

-- ============================================
-- (a) Backfill 'pro' quota values onto 'professional'
--     (same values 20260427100000 set for slug = 'pro')
-- ============================================

UPDATE plans SET
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('messages_per_month', 21000, 'tokens_per_month', 21000000),
    limits = COALESCE(limits, '{}'::jsonb)
        || jsonb_build_object('max_messages', 21000, 'tokens_per_month', 21000000),
    updated_at = NOW()
WHERE slug = 'professional'
  AND NOT (COALESCE(limits, '{}'::jsonb) ? 'tokens_per_month');

-- ============================================
-- (b) Replace legacy OpenAI model ids with the real Gemini model id
-- ============================================

UPDATE plans SET
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('ai_model', 'gemini-3.1-flash-lite'),
    updated_at = NOW()
WHERE COALESCE(features, '{}'::jsonb) ->> 'ai_model' IN ('gpt-4o', 'gpt-4o-mini');

-- ============================================
-- (c) Deactivate the seeded 'free' plan (subscribe rejects amount = 0)
-- ============================================

UPDATE plans SET
    is_active = false,
    updated_at = NOW()
WHERE slug = 'free'
  AND is_active = true;
