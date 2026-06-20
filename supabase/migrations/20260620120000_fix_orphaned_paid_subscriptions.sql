-- Fix the two data-integrity gaps behind orphaned PAID subscriptions
-- (a customer pays via QPay, but no `subscriptions` row is ever created, so the
-- user-scoped billing in getUserBilling/`/api/features` resolves to 'unpaid' and
-- every plan-gated feature stays locked despite payment).
--
-- Root causes found in production (shop "Домбо Хундага", 2026-06-19):
--
--   1. `subscriptions_status_check` rejected 'pending'. But /api/subscription/
--      subscribe, upsertUserSubscription's OPEN_STATUSES, and the partial unique
--      index `subscriptions_user_active_unique` all treat 'pending' as a valid
--      open state. Every subscribe-time pending write therefore failed (the call
--      site swallows it as a non-fatal warning) and no pending row was stored.
--
--   2. `subscriptions.user_id` references `user_profiles(id)`. A few auth users
--      never received a `user_profiles` row (the handle_new_user trigger missed
--      them), so the activation INSERT failed the FK and the paid plan was never
--      recorded — orphaning the payment.

-- ── 1) Allow 'pending' on subscriptions.status ───────────────────────────────
-- New set is a superset of every status currently present (active, trialing),
-- so re-validating existing rows cannot fail.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'pending', 'past_due', 'canceled', 'expired'));

-- ── 2) Re-assert the profile-creation trigger and backfill stragglers ─────────
-- Guarantees the user_profiles row that subscriptions.user_id depends on exists
-- for every auth user, closing the FK gap that orphaned the paid subscription.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Only users with an email: user_profiles.email is NOT NULL. The rare
-- null-email auth row (e.g. phone-only signup) is skipped rather than inserted
-- with a fake address; handle those separately if they ever need a profile.
INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email), created_at, updated_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
