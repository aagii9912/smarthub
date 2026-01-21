-- AI Sales Intelligence: Add customer memory
-- Stores customer preferences learned by AI (sizes, colors, styles, etc.)

-- Add AI Memory column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS ai_memory JSONB DEFAULT '{}';

-- Index for faster JSONB lookups
CREATE INDEX IF NOT EXISTS idx_customers_ai_memory 
ON customers USING gin(ai_memory);

-- Add comment for documentation
COMMENT ON COLUMN customers.ai_memory IS 'AI-learned customer preferences: sizes, colors, styles, interests';

SELECT 'AI memory column added to customers table ✅' as result;
