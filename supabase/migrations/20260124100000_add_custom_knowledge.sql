-- Add custom_knowledge column to shops table for AI context
ALTER TABLE shops ADD COLUMN IF NOT EXISTS custom_knowledge JSONB DEFAULT '{}'::jsonb;
