-- ============================================
-- AI INFO SHARING CONTROLS (Issue #5b, #5c)
-- ============================================
-- The shop owner needs explicit per-field control over what the AI is
-- allowed to disclose to the customer (phone number, address, working
-- hours, policies, business description). Today the AI either includes
-- everything in the system prompt or nothing — there is no granular knob.
--
-- This migration:
--   1. Adds `address` + `business_hours` text columns so structured contact
--      info has a home (today they live in `custom_knowledge` JSONB).
--   2. Adds 5 BOOLEAN toggles (`ai_share_*`) controlling whether the AI
--      may share each piece of info with customers.
--   3. Backwards-compatible defaults: description + policies default to
--      `true` so existing shops don't suddenly stop greeting customers,
--      while phone/address/hours default to `false` so private contact
--      details aren't disclosed unless the owner opts in.
-- ============================================

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS business_hours TEXT,
    ADD COLUMN IF NOT EXISTS ai_share_phone BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_share_address BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_share_hours BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_share_policies BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ai_share_description BOOLEAN NOT NULL DEFAULT true;

-- For shops that already exist, keep the historical behaviour: description
-- and policies were always shared, so flip the new flags accordingly even
-- if the column-level default already says true (idempotent UPDATE).
UPDATE shops
SET ai_share_description = true,
    ai_share_policies = true
WHERE ai_share_description IS NULL OR ai_share_policies IS NULL;
