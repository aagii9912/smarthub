-- Add AI settings columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS ai_emotion TEXT DEFAULT 'friendly',
ADD COLUMN IF NOT EXISTS ai_instructions TEXT;
