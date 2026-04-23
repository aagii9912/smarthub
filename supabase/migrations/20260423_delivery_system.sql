-- ══════════════════════════════════════════════════════════
-- DELIVERY SYSTEM MIGRATION
-- Adds delivery configuration to products and orders
-- Safe to re-run (all IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════

-- Step 1: Product delivery type enum
DO $$ BEGIN
  CREATE TYPE delivery_type AS ENUM (
    'included',     -- Хүргэлт үнэд багтсан
    'paid',         -- Хүргэлт нэмэлт төлбөртэй
    'pickup_only'   -- Зөвхөн очиж авах
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add delivery columns to products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS delivery_type delivery_type DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN products.delivery_type IS 
  'included=хүргэлт үнэд багтсан, paid=нэмэлт төлбөртэй, pickup_only=очиж авах';
COMMENT ON COLUMN products.delivery_fee IS 
  'Хүргэлтийн нэмэлт төлбөр (зөвхөн paid type үед хэрэглэнэ)';

-- Step 3: Order delivery method enum
DO $$ BEGIN
  CREATE TYPE delivery_method AS ENUM (
    'delivery',     -- Хүргэлтээр
    'pickup'        -- Очиж авах
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 4: Add delivery columns to orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS delivery_method delivery_method DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

COMMENT ON COLUMN orders.delivery_method IS 
  'delivery=хүргэлтээр, pickup=очиж авах';
COMMENT ON COLUMN orders.delivery_fee IS 
  'Хүргэлтийн нэмэлт төлбөр (paid type-ийн бүтээгдэхүүн агуулсан үед)';
COMMENT ON COLUMN orders.customer_phone IS 
  'Хэрэглэгчийн холбогдох утасны дугаар';

-- Step 5: Add address to shops (for pickup location)
ALTER TABLE shops 
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN shops.address IS 
  'Дэлгүүрийн хаяг (pickup_only бүтээгдэхүүнд очиж авах газар)';

-- Step 6: Indexes
CREATE INDEX IF NOT EXISTS idx_orders_delivery_method 
  ON orders(delivery_method) WHERE delivery_method IS NOT NULL;

SELECT 'Delivery system migration completed successfully! ✅' as result;
