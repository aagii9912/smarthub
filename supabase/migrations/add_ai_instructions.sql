-- Add ai_instructions column to shops table
-- This allows shop owners to customize AI chatbot behavior

ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_instructions TEXT;

-- Add description column for shop description (used by AI)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN shops.ai_instructions IS 'Custom instructions for AI chatbot behavior';
COMMENT ON COLUMN shops.description IS 'Shop description used by AI for context';
