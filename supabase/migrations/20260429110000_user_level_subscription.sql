-- ============================================================
-- Move subscription scope from per-shop to per-user.
--   • subscriptions gains user_id (backfilled from shops.user_id)
--   • UNIQUE(shop_id) is dropped; partial UNIQUE on user_id added
--     so a user has at most one open subscription at a time.
--   • Rolling-30-day token pool fields land on subscriptions.
--   • user_profiles gets a denormalized plan/status snapshot
--     so feature/limit lookups don't need to walk shop rows.
--
-- Note: legacy `shops.user_id` is TEXT (carried over from Clerk).
-- We cast to UUID at every assignment/comparison to UUID columns.
-- shops has no updated_at column either — orderings use created_at.
-- ============================================================

-- 1. user_id on subscriptions
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

UPDATE subscriptions sub
SET user_id = NULLIF(sh.user_id, '')::uuid
FROM shops sh
WHERE sub.shop_id = sh.id
  AND sub.user_id IS NULL;

-- Drop subs that we couldn't backfill (orphaned by deleted shops, or rows
-- whose shops.user_id is non-uuid garbage). The UNIQUE(shop_id) we're about
-- to drop already prevented duplicates, so deletion is safe.
DELETE FROM subscriptions WHERE user_id IS NULL;

ALTER TABLE subscriptions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN shop_id DROP NOT NULL;

-- 2. Replace UNIQUE(shop_id) with a partial UNIQUE on (user_id) for open states.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_shop_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_unique
    ON subscriptions (user_id)
    WHERE status IN ('active', 'trialing', 'pending', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- 3. Rolling pool counters on subscriptions
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS period_anchor_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tokens_used_in_period BIGINT NOT NULL DEFAULT 0;

UPDATE subscriptions
SET period_anchor_at = COALESCE(period_anchor_at, current_period_start, created_at, NOW())
WHERE period_anchor_at IS NULL;

-- 4. Denormalized snapshot on user_profiles
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id),
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Backfill from each user's "best" existing shop (any shop with a non-trial
-- plan, otherwise the most recently created shop). Cast shops.user_id to
-- UUID so the join against user_profiles.id succeeds.
WITH best_shop AS (
    SELECT DISTINCT ON (NULLIF(user_id, '')::uuid)
           NULLIF(user_id, '')::uuid AS user_id,
           plan_id,
           subscription_plan,
           subscription_status,
           trial_ends_at
    FROM shops
    WHERE user_id IS NOT NULL
      AND user_id <> ''
    ORDER BY NULLIF(user_id, '')::uuid,
             CASE
                 WHEN subscription_status = 'active' THEN 0
                 WHEN subscription_status = 'trialing' THEN 1
                 WHEN subscription_status = 'trial' THEN 2
                 ELSE 9
             END,
             created_at DESC NULLS LAST
)
UPDATE user_profiles up
SET plan_id = COALESCE(up.plan_id, bs.plan_id),
    subscription_plan = COALESCE(up.subscription_plan, bs.subscription_plan),
    subscription_status = COALESCE(up.subscription_status, bs.subscription_status),
    trial_ends_at = COALESCE(up.trial_ends_at, bs.trial_ends_at)
FROM best_shop bs
WHERE up.id = bs.user_id;

-- 5. Comments — make the new shape easy to read in psql.
COMMENT ON COLUMN subscriptions.user_id IS 'Owner of the subscription. Source of truth for plan/quota across all the user''s shops.';
COMMENT ON COLUMN subscriptions.period_anchor_at IS 'Start of the current rolling 30-day token window.';
COMMENT ON COLUMN subscriptions.tokens_used_in_period IS 'Sum of tokens consumed by every shop owned by this user during the current 30-day window.';
COMMENT ON COLUMN user_profiles.subscription_plan IS 'Denormalized plan slug for fast feature lookup. Synced by the subscription/payment endpoints.';
