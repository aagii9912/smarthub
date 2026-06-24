-- ============================================
-- Fix: payment_integration feature flag for Starter & Pro plans
-- ============================================
-- Root cause:
--   20260119140000_expand_features.sql set
--       'payment_integration', slug IN ('professional', 'enterprise')
--   which explicitly excluded the Starter plan. The live row's slug is 'Starter'
--   (capitalised), so payment_integration stayed at its default of false.
--   ('professional' and 'enterprise' correctly received true.)
--
-- Impact:
--   /api/features reads plans.features.payment_integration from the DB. With it
--   false, the Settings page shows "QPay won't auto-activate on this plan" and the
--   AI is treated as unable to collect payments — even though Starter, Pro and
--   Enterprise all include payment integration per the plan design (see
--   src/lib/ai/config/plans.ts PLAN_CONFIGS.*.features.paymentIntegration).
--
-- NOTE: plan slugs in this DB are inconsistently cased ('Starter') so we match on
--   lower(slug). Lite stays false intentionally (bank info is quote-only on Lite).

UPDATE plans
SET features   = COALESCE(features, '{}'::jsonb)
                 || jsonb_build_object('payment_integration', true),
    updated_at = NOW()
WHERE lower(slug) IN ('starter', 'pro', 'professional', 'enterprise');

SELECT 'payment_integration enabled for starter/pro/enterprise' AS result;
