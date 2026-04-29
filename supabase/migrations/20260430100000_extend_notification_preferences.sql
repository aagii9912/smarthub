-- ============================================
-- Extend per-shop notification preferences
-- ============================================
-- Existing flags (notify_on_order/contact/support/cancel/complaints) cover
-- AI-driven topics. This migration adds flags for the new triggers wired up
-- in PaymentConfirmationService, payment audit, customer onboarding, the
-- subscription/trial flow, comment automation, and Excel import. All default
-- TRUE so existing shops continue to receive every notification.
--
-- Also adds `trial_ending_notified_at` so the daily trial-expiry cron can
-- de-duplicate the "ending in 3 days" reminder.
-- ============================================

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS notify_on_payment_received BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_payment_failed   BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_refund           BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_new_customer     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_subscription     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_automation       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_plan_limit       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_low_stock        BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_on_import           BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS trial_ending_notified_at   TIMESTAMPTZ;
