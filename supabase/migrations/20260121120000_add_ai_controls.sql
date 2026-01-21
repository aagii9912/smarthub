-- Add AI pause timestamp to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ DEFAULT NULL;

-- Add Global AI switch to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS is_ai_active BOOLEAN DEFAULT TRUE;

-- Add index for performance on large customer bases
CREATE INDEX IF NOT EXISTS idx_customers_ai_paused_until ON customers(ai_paused_until);
