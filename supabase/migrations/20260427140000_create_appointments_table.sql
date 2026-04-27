-- Appointment booking MVP
-- Stores customer reservations against type='appointment' products.

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

CREATE INDEX IF NOT EXISTS appointments_shop_scheduled_idx
  ON appointments(shop_id, scheduled_at);
CREATE INDEX IF NOT EXISTS appointments_product_scheduled_idx
  ON appointments(product_id, scheduled_at);
CREATE INDEX IF NOT EXISTS appointments_customer_idx
  ON appointments(customer_id);

-- updated_at trigger (reuses pattern from other tables)
CREATE OR REPLACE FUNCTION set_appointments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_updated_at_trg ON appointments;
CREATE TRIGGER appointments_updated_at_trg
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_appointments_updated_at();

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners read own appointments" ON appointments;
CREATE POLICY "Shop owners read own appointments"
  ON appointments FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Shop owners modify own appointments" ON appointments;
CREATE POLICY "Shop owners modify own appointments"
  ON appointments FOR ALL
  USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
  );

-- Service role (used by AI webhook) bypasses RLS implicitly.

COMMENT ON TABLE appointments IS 'Customer reservations against appointment-type products';
COMMENT ON COLUMN appointments.scheduled_at IS 'Actual booked time (UTC)';
COMMENT ON COLUMN appointments.status IS 'pending | confirmed | cancelled | completed | no_show';
