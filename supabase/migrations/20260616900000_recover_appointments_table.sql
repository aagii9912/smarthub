-- Drift recovery: re-assert the `appointments` table.
--
-- The remote migration history records 20260427140000_create_appointments_table
-- as applied, but the table is missing on the production DB (history ↔ schema
-- drift — same class of issue as 20260615120000_repair_missing_crm_columns).
-- The salon migrations (20260617000000, 20260618000000) ALTER appointments and
-- abort the whole `db push` without it.
--
-- Ordered just before those migrations so the table exists when they run. Every
-- statement is idempotent, so this is a no-op wherever appointments already exists.

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_shop_scheduled_idx ON appointments(shop_id, scheduled_at);
CREATE INDEX IF NOT EXISTS appointments_product_scheduled_idx ON appointments(product_id, scheduled_at);
CREATE INDEX IF NOT EXISTS appointments_customer_idx ON appointments(customer_id);

DROP TRIGGER IF EXISTS appointments_updated_at_trg ON appointments;
CREATE TRIGGER appointments_updated_at_trg
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Team-aware RLS (owner + active member). shops.user_id is TEXT → cast auth.uid().
DROP POLICY IF EXISTS "appointments by shop team" ON appointments;
CREATE POLICY "appointments by shop team" ON appointments FOR ALL
  USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND status = 'active')
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND status = 'active')
  );
