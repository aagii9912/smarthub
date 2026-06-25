-- ============================================
-- 3 хоногийн trial-ийг бүрэн болих → бүгдийг үнэгүй Lite руу шилжүүлэх
-- ============================================
-- Background:
--   Lite план одоо ҮНЭГҮЙ болсон тул 3 хоногийн trial илүүдэл болсон. Энэ
--   migration trial-тэй холбоотой бүх төлвийг үнэгүй Lite (active) руу
--   шилжүүлж, trial concept-ийг бүрэн арилгана:
--     - subscriptions.status 'trialing'        → 'active' (Lite, trial_ends_at цэвэрлэнэ)
--     - user_profiles.subscription_status      → 'active' Lite
--     - shops.subscription_status              → 'active' Lite (trial markers цэвэрлэнэ)
--   Lite үнэгүй учир trial болон дууссан trial хэрэглэгчдэд дахин AI эрх олгох нь
--   зардалгүй бөгөөд "үнэгүй Lite-аар хэрэглэгч татах" зорилготой нийцнэ.
--
-- Idempotent: дахин ажиллуулахад trial төлөв үлдээгүй тул no-op.

DO $$
DECLARE
    lite_id uuid;
BEGIN
    SELECT id INTO lite_id FROM plans WHERE slug = 'lite' LIMIT 1;

    -- ── subscriptions: in-flight + expired trial-ууд → active Lite ──────────
    UPDATE subscriptions
       SET status = 'active',
           plan_id = COALESCE(lite_id, plan_id),
           trial_ends_at = NULL,
           current_period_start = COALESCE(current_period_start, NOW()),
           current_period_end = NOW() + INTERVAL '1 month',
           period_anchor_at = COALESCE(period_anchor_at, NOW()),
           tokens_used_in_period = COALESCE(tokens_used_in_period, 0),
           updated_at = NOW()
     WHERE status = 'trialing';

    -- ── user_profiles snapshot (middleware paywall энэ дээр уншина) ─────────
    UPDATE user_profiles
       SET subscription_status = 'active',
           subscription_plan = 'lite',
           plan_id = COALESCE(lite_id, plan_id),
           trial_ends_at = NULL,
           updated_at = NOW()
     WHERE subscription_status IN ('trialing', 'trial', 'expired_trial');

    -- ── shops (updated_at багана байхгүй) ──────────────────────────────────
    UPDATE shops
       SET subscription_status = 'active',
           subscription_plan = 'lite',
           plan_id = COALESCE(lite_id, plan_id),
           trial_ends_at = NULL,
           trial_expired_at = NULL,
           is_ai_active = true
     WHERE subscription_status IN ('trial', 'trialing', 'expired_trial');
END $$;
