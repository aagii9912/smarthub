-- ============================================
-- AI Settings Completeness — Phase 1 Foundation
-- ============================================
-- Adds two new columns to support a more complete, business-type-aware
-- AI settings page:
--
--   1. working_hours_structured — replaces the free-text working_hours
--      string with a per-weekday open/close schema so the AI can answer
--      "are you open tomorrow?" without hallucinating.
--
--   2. ai_settings_completed_at — separate from ai_setup_completed_at,
--      tracks whether the owner has actually finished the *advanced*
--      AI settings (brand voice, prohibited topics, per-type extras).
--      Surfaces the wizard / banner on the AI settings page when NULL.
--
-- All other new fields (brand_voice, prohibited_topics, supported_languages,
-- escalation_rules, seasonal_promotions, fulfillment_sla, per-business-type
-- AI-specific extras) live inside the existing JSONB blobs to avoid
-- schema churn:
--   shops.ai_agent_config.cross_cutting.*
--   shops.business_setup_data.*

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS working_hours_structured JSONB,
  ADD COLUMN IF NOT EXISTS ai_settings_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shops_ai_settings_completed_at
  ON shops(ai_settings_completed_at) WHERE ai_settings_completed_at IS NOT NULL;

COMMENT ON COLUMN shops.working_hours_structured IS
  'Per-weekday open/close hours. Schema: { mon: {open: "09:00", close: "18:00", closed?: false}, tue: {...}, ... }. NULL means not configured — falls back to free-text working_hours.';

COMMENT ON COLUMN shops.ai_settings_completed_at IS
  'Timestamp the owner finished filling out the advanced AI settings (brand voice, per-type extras, etc.). Distinct from ai_setup_completed_at which tracks the initial agent wizard.';
