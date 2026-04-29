-- Add trial_ends_at to subscriptions so the user-level start-trial flow
-- can record when the 3-day Lite trial expires. user_profiles already has
-- a denormalized snapshot (added in 20260429110000); this is the source
-- of truth that the snapshot mirrors.

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN subscriptions.trial_ends_at IS
    'Trial expiry timestamp. NULL for paid plans. Used by start-trial flow and prev-trial guard.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at
    ON subscriptions(trial_ends_at)
    WHERE trial_ends_at IS NOT NULL;
