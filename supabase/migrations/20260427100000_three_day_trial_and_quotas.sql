-- 3-day free trial default + token quota update + Starter price update
-- Зөвхөн шинээр үүсэх shops-д 14d → 3d-н default тогтоогдоно.
-- Одоо trial идэвхтэй байгаа shops-н хадгалсан trial_ends_at хүндэтгэгдэнэ.

-- ============================================
-- SHOPS: Trial default + expired marker
-- ============================================

ALTER TABLE shops
    ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '3 days');

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS trial_expired_at TIMESTAMPTZ;

COMMENT ON COLUMN shops.trial_ends_at IS '3-хоногийн туршилт дуусах огноо (default NOW() + 3 days)';
COMMENT ON COLUMN shops.trial_expired_at IS 'Туршилт хугацаандаа дууссаныг тэмдэглэх огноо (cron-оор бичигдэнэ)';

-- ============================================
-- PLANS: Token quota + Starter price update
-- ============================================
-- Одоо байгаа plan мөрүүдийг IN-PLACE update хийнэ — IDs/FKs хадгалагдана.

UPDATE plans SET
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('messages_per_month', 5000, 'tokens_per_month', 5000000),
    limits = COALESCE(limits, '{}'::jsonb)
        || jsonb_build_object('max_messages', 5000, 'tokens_per_month', 5000000),
    updated_at = NOW()
WHERE slug = 'lite';

UPDATE plans SET
    price_monthly = 149000,
    price_yearly = 1788000,
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('messages_per_month', 8500, 'tokens_per_month', 8500000),
    limits = COALESCE(limits, '{}'::jsonb)
        || jsonb_build_object('max_messages', 8500, 'tokens_per_month', 8500000),
    updated_at = NOW()
WHERE slug = 'starter';

UPDATE plans SET
    features = COALESCE(features, '{}'::jsonb)
        || jsonb_build_object('messages_per_month', 21000, 'tokens_per_month', 21000000),
    limits = COALESCE(limits, '{}'::jsonb)
        || jsonb_build_object('max_messages', 21000, 'tokens_per_month', 21000000),
    updated_at = NOW()
WHERE slug = 'pro';
