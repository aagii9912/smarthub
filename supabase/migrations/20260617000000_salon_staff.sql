-- ============================================
-- Salon architecture — Phase 1: staff, appointment↔staff, service category
-- ============================================
-- Beauty/booking бизнест зориулсан гүн архитектур:
--   1. `staff` — салоны мэргэжилтнүүд (нэр, мэргэжил, өнгө, per-staff хуваарь)
--   2. `appointments.staff_id` — уулзалт бүр ажилтантай холбогдоно
--   3. `products.category` — үйлчилгээний төрлөөр бүлэглэх
--
-- Бүх statement idempotent. API нь service-role-оор shop_id-аар хязгаарладаг;
-- RLS нь defense-in-depth (эзэн + идэвхтэй багийн гишүүн).

-- ── 1) staff хүснэгт ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,                          -- мэргэжил (үс засагч, гоо сайханч…)
  phone TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',   -- календарт ялгах өнгө
  is_active BOOLEAN NOT NULL DEFAULT true,
  working_hours JSONB,                     -- { mon:{open,close,closed?}, … } per-staff
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_shop ON staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_shop_active ON staff(shop_id) WHERE is_active;

-- updated_at trigger (cart системээс ирсэн нийтлэг функцийг дахин ашиглана)
DROP TRIGGER IF EXISTS staff_updated_at ON staff;
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- shops.user_id нь TEXT тул auth.uid()::text-ээр харьцуулна. Эзэн эсвэл
-- идэвхтэй багийн гишүүн (shop_members) уншиж/засна.
DROP POLICY IF EXISTS "staff readable by shop team" ON staff;
CREATE POLICY "staff readable by shop team" ON staff FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "staff writable by shop team" ON staff;
CREATE POLICY "staff writable by shop team" ON staff FOR ALL
  USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND status = 'active')
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- ── 2) appointments.staff_id ─────────────────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id);

-- ── 3) products.category (үйлчилгээний төрөл) ────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_products_shop_category ON products(shop_id, category) WHERE category IS NOT NULL;

COMMENT ON TABLE staff IS 'Салоны мэргэжилтнүүд — booking бизнест appointments-тэй холбогдоно.';
COMMENT ON COLUMN staff.working_hours IS 'Per-staff долоо хоногийн хуваарь: { mon:{open:"09:00",close:"18:00",closed?:bool}, … }. NULL бол shops.working_hours_structured руу fallback.';
COMMENT ON COLUMN products.category IS 'Үйлчилгээ/барааны төрөл — дашбордын бүлэглэлд хэрэглэнэ.';
