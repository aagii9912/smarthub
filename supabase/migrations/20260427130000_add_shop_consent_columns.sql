-- Add consent tracking columns to shops table for legal audit trail
-- Captures Terms / Privacy / Age / Marketing consent collected at the
-- subscription step of the setup wizard.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN shops.terms_accepted_at IS 'When the shop owner accepted the Terms of Service';
COMMENT ON COLUMN shops.terms_version IS 'Version (last-updated date) of Terms accepted, e.g. "2026-01-06"';
COMMENT ON COLUMN shops.privacy_accepted_at IS 'When the shop owner accepted the Privacy Policy';
COMMENT ON COLUMN shops.privacy_version IS 'Version of Privacy Policy accepted';
COMMENT ON COLUMN shops.age_confirmed IS 'User confirmed they are 18+ years old';
COMMENT ON COLUMN shops.marketing_consent IS 'Optional opt-in for marketing emails';
COMMENT ON COLUMN shops.marketing_consent_at IS 'When marketing consent was given (NULL if never)';
