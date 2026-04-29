-- ============================================
-- AI Agent Roles + extended business types
-- ============================================
-- Adds first-class agent role concept to shops so the AI can act as
-- sales, booking, information, support, lead_capture, or hybrid (a union
-- of capabilities). Also adds three new business types: healthcare,
-- education, realestate_auto.
--
-- Existing shops are migrated to a sensible default role based on their
-- current business_type. The AI router falls back to 'sales' for any
-- shop that doesn't have a role set, preserving today's behaviour.

-- ── 1) Extend business_type CHECK constraint ───────────────────────
ALTER TABLE shops
  DROP CONSTRAINT IF EXISTS shops_business_type_check;

ALTER TABLE shops
  ADD CONSTRAINT shops_business_type_check
    CHECK (business_type IN (
      'retail','restaurant','service','ecommerce','beauty','other',
      'healthcare','education','realestate_auto'
    ));

-- ── 2) Agent role columns ──────────────────────────────────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS ai_agent_role TEXT NOT NULL DEFAULT 'sales'
    CHECK (ai_agent_role IN (
      'sales','booking','information','support','lead_capture','hybrid'
    )),
  ADD COLUMN IF NOT EXISTS ai_agent_capabilities TEXT[] NOT NULL DEFAULT ARRAY['sales']::TEXT[],
  ADD COLUMN IF NOT EXISTS ai_agent_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_agent_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_setup_completed_at TIMESTAMPTZ;

-- ── 3) Migrate existing shops to a sensible default role ───────────
-- The CASE mirrors BUSINESS_ROLE_RECOMMENDATIONS in
-- src/lib/ai/agents/registry.ts. Keep them in sync if you change either.
UPDATE shops SET
  ai_agent_role = CASE business_type
    WHEN 'restaurant' THEN 'hybrid'
    WHEN 'service' THEN 'booking'
    WHEN 'beauty' THEN 'booking'
    WHEN 'healthcare' THEN 'hybrid'
    WHEN 'education' THEN 'hybrid'
    WHEN 'realestate_auto' THEN 'hybrid'
    ELSE 'sales'
  END,
  ai_agent_capabilities = CASE business_type
    WHEN 'restaurant' THEN ARRAY['sales','booking','information']
    WHEN 'service' THEN ARRAY['booking','information']
    WHEN 'beauty' THEN ARRAY['booking','information']
    WHEN 'healthcare' THEN ARRAY['booking','information']
    WHEN 'education' THEN ARRAY['information','lead_capture']
    WHEN 'realestate_auto' THEN ARRAY['lead_capture','information']
    WHEN 'retail' THEN ARRAY['sales','support']
    WHEN 'ecommerce' THEN ARRAY['sales','support']
    ELSE ARRAY['sales']
  END
-- Only update rows that haven't been explicitly configured yet.
WHERE ai_setup_completed_at IS NULL;

-- ── 4) Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shops_ai_agent_role
  ON shops(ai_agent_role);

-- ── 5) Documentation ───────────────────────────────────────────────
COMMENT ON COLUMN shops.ai_agent_role IS
  'Primary agent role: sales | booking | information | support | lead_capture | hybrid. Drives system prompt + tool whitelist.';

COMMENT ON COLUMN shops.ai_agent_capabilities IS
  'Active capability set (used when ai_agent_role = hybrid). Each entry must be one of: sales, booking, information, support, lead_capture.';

COMMENT ON COLUMN shops.ai_agent_config IS
  'JSONB blob for role-specific config (per-tool overrides, custom slots, etc.). Schema is application-level.';

COMMENT ON COLUMN shops.ai_agent_name IS
  'Display name the AI introduces itself with (e.g. "Сүхээ"). Optional.';

COMMENT ON COLUMN shops.ai_setup_completed_at IS
  'Timestamp the user finished the AI setup wizard. NULL = never ran the wizard, surfaces it on the AI Settings page.';
