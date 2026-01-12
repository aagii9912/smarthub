-- SmartHub Feature Enhancements Migration
-- Features: Reserved stock, AI toggle, AI emotion, Discount percentage

-- ============================================
-- Feature 1: Reserved stock for pending payments
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;

-- Index for faster queries on reserved products
CREATE INDEX IF NOT EXISTS idx_products_reserved ON products(reserved_stock) WHERE reserved_stock > 0;

-- ============================================
-- Feature 3: AI toggle per shop
-- ============================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;

-- ============================================
-- Feature 9: AI emotion/personality
-- ============================================
DO $$ BEGIN
    CREATE TYPE ai_emotion AS ENUM ('friendly', 'professional', 'enthusiastic', 'calm', 'playful');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_emotion TEXT DEFAULT 'friendly';

-- ============================================
-- Feature 10: Discount percentage for products
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;

-- Constraint: discount must be between 0 and 100 (only add if not exists)
DO $$ BEGIN
    ALTER TABLE products ADD CONSTRAINT chk_discount_range 
        CHECK (discount_percent >= 0 AND discount_percent <= 100);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

SELECT 'Feature enhancements migration completed successfully! ✅' as result;
