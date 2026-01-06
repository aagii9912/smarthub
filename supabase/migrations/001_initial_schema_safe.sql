-- SmartHub Database Schema (Safe Version)
-- Run this in Supabase SQL Editor
-- Дахин ажиллуулж болно - алдаа гарахгүй

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SHOPS (Дэлгүүрүүд)
-- ============================================
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  facebook_page_id TEXT UNIQUE,
  owner_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS (Бүтээгдэхүүнүүд)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;

-- ============================================
-- CUSTOMERS (Хэрэглэгчид)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  facebook_id TEXT,
  name TEXT,
  phone TEXT,
  address TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  is_vip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, facebook_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_vip ON customers(is_vip) WHERE is_vip = true;

-- ============================================
-- ORDERS (Захиалгууд)
-- ============================================
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed', 
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status order_status DEFAULT 'pending',
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- ============================================
-- ORDER ITEMS (Захиалгын бараа)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================
-- CHAT HISTORY (Чат түүх)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  message TEXT,
  response TEXT,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_shop ON chat_history(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_customer ON chat_history(customer_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update customer stats after order
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'delivered' THEN
    UPDATE customers 
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total_amount,
      is_vip = CASE WHEN total_spent + NEW.total_amount >= 1000000 THEN true ELSE is_vip END
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_on_order ON orders;
CREATE TRIGGER update_customer_on_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- ============================================
-- SAMPLE DATA (Жишээ өгөгдөл)
-- ============================================

-- Insert sample shop (only if not exists)
INSERT INTO shops (id, name, owner_name, phone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Дэлгүүр', 'Админ', '99001122')
ON CONFLICT (id) DO NOTHING;

-- Insert sample products (only if not exists)
INSERT INTO products (shop_id, name, description, price, stock) 
SELECT 
  '00000000-0000-0000-0000-000000000001',
  name,
  description,
  price,
  stock
FROM (VALUES
  ('Хар куртка', 'Өвлийн дулаан куртка, S-XXL размертай', 185000, 15),
  ('Цагаан цамц', 'Албан ёсны цамц, M-XL размер', 45000, 30),
  ('Спорт гутал', 'Nike гутал, 38-45 размер', 120000, 8),
  ('Гоёлын даашинз', 'Зуны даашинз, S-L размер', 250000, 5),
  ('Джинс өмд', 'Levi''s хөх өмд, 28-36 размер', 95000, 22)
) AS v(name, description, price, stock)
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE shop_id = '00000000-0000-0000-0000-000000000001'
);

-- Insert sample customers (only if not exists)
INSERT INTO customers (shop_id, name, phone, address, total_orders, total_spent, is_vip)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  name,
  phone,
  address,
  total_orders,
  total_spent,
  is_vip
FROM (VALUES
  ('Болд Бат', '99001122', 'БЗД, 3-р хороо', 12, 2450000, true),
  ('Сараа Дорж', '99112233', 'СХД, 15-р хороо', 5, 580000, false),
  ('Дорж Батсүх', '99223344', 'ЧД, Сансар', 8, 1200000, true),
  ('Оюунаа Мөнх', '99334455', 'ХУД, Зайсан', 3, 450000, false)
) AS v(name, phone, address, total_orders, total_spent, is_vip)
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE shop_id = '00000000-0000-0000-0000-000000000001'
);

SELECT 'SmartHub database schema created/updated successfully! ✅' as result;

