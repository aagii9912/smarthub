-- ============================================
-- Normalize plan slug casing/naming to canonical lowercase values
-- ============================================
-- Background:
--   009_add_subscription_system.sql seeds lowercase slugs ('starter',
--   'professional'), but the live `plans` table has since drifted to a
--   capitalised 'Starter' and kept the long-form 'professional'. The code
--   treats the canonical PlanType slugs as lowercase 'starter' / 'pro'
--   (src/lib/ai/config/plans.ts), so every raw `.eq('slug', '<lowercase>')`
--   lookup silently misses the 'Starter' / 'professional' rows and falls back
--   to a minimal/default feature set. Masked today only because most paths try
--   plan_id (UUID) first; it bites when plan_id is null but subscription_plan
--   is set, and the pay/activation paths that resolve purely by slug.
--
--   Verified live state (service-role, 2026-06-20, project vmdfbijndijigohujfhr):
--     plans.slug:                         'Starter' x1, 'professional' x1
--     user_profiles.subscription_plan:    'Starter' x1, 'professional' x5
--     shops.subscription_plan:            'Starter' x1, 'professional' x10
--     payments.subscription_plan_slug:    'Starter' x3, 'professional' x1  (2 pending)
--     collision: neither 'starter' nor 'pro' exists in plans -> safe to rename
--
-- Strategy: rename the slugs to canonical lowercase ('starter', 'pro') and
--   rewrite every denormalized snapshot that stores the slug as text. The
--   `subscriptions` table references the plan by plan_id (UUID), so it needs no
--   change — its `plans(slug)` joins resolve to the new value automatically.
--
-- Idempotent: re-running matches zero legacy rows. Collision-guarded: a rename
--   is skipped if the canonical slug already exists (plans.slug is UNIQUE), so
--   this can never raise a duplicate-key error.
--
-- NOTE: does NOT touch the payment_integration flag (handled in
--   20260620130000_fix_starter_pro_payment_integration.sql).

BEGIN;

-- ── (a) plans.slug — collision-guarded renames ───────────────────────────────
UPDATE plans SET slug = 'starter', updated_at = NOW()
 WHERE slug = 'Starter'
   AND NOT EXISTS (SELECT 1 FROM plans p2 WHERE p2.slug = 'starter');

UPDATE plans SET slug = 'pro', updated_at = NOW()
 WHERE slug = 'professional'
   AND NOT EXISTS (SELECT 1 FROM plans p2 WHERE p2.slug = 'pro');

-- ── (b) user_profiles.subscription_plan (has updated_at) ──────────────────────
UPDATE user_profiles SET subscription_plan = 'starter', updated_at = NOW()
 WHERE subscription_plan = 'Starter';
UPDATE user_profiles SET subscription_plan = 'pro', updated_at = NOW()
 WHERE subscription_plan = 'professional';

-- ── (c) shops.subscription_plan (NO updated_at column on shops) ───────────────
UPDATE shops SET subscription_plan = 'starter' WHERE subscription_plan = 'Starter';
UPDATE shops SET subscription_plan = 'pro'     WHERE subscription_plan = 'professional';

-- ── (d) payments.subscription_plan_slug (incl. the 2 pending rows whose
--        activation would otherwise fail to resolve the renamed plan) ──────────
UPDATE payments SET subscription_plan_slug = 'starter' WHERE subscription_plan_slug = 'Starter';
UPDATE payments SET subscription_plan_slug = 'pro'     WHERE subscription_plan_slug = 'professional';

-- ── Post-condition assertion: no legacy slug may survive in any surface ───────
DO $$
DECLARE leftover INTEGER;
BEGIN
    SELECT
        (SELECT count(*) FROM plans          WHERE slug                  IN ('Starter','professional'))
      + (SELECT count(*) FROM user_profiles  WHERE subscription_plan     IN ('Starter','professional'))
      + (SELECT count(*) FROM shops          WHERE subscription_plan     IN ('Starter','professional'))
      + (SELECT count(*) FROM payments       WHERE subscription_plan_slug IN ('Starter','professional'))
      INTO leftover;
    IF leftover <> 0 THEN
        RAISE EXCEPTION 'plan-slug normalization left % legacy reference(s) behind', leftover;
    END IF;
END $$;

COMMIT;
