-- ============================================
-- Business Type for Shops (Setup Wizard)
-- ============================================
-- Adds a business taxonomy + per-type setup answers so the setup wizard
-- can render type-specific steps (Дэлгүүр, Ресторан, Үйлчилгээ,
-- E-commerce, Гоо сайхан, Бусад). Existing rows get NULL business_type;
-- they keep working as-is and can pick a type later via dashboard settings.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS business_type TEXT
    CHECK (business_type IN ('retail','restaurant','service','ecommerce','beauty','other')),
  ADD COLUMN IF NOT EXISTS business_setup_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_shops_business_type
  ON shops(business_type)
  WHERE business_type IS NOT NULL;

COMMENT ON COLUMN shops.business_type IS
  'Business category — drives setup wizard flow and dashboard customization. One of: retail, restaurant, service, ecommerce, beauty, other.';

COMMENT ON COLUMN shops.business_setup_data IS
  'Per-business-type setup answers (operations step). Schema varies by business_type. App-level Zod validates the shape.';
