-- ============================================
-- Salon Phase 2b: appointment payment tracking
-- ============================================
-- "Цаг захиалга" хуудсанд төлбөрийг 100% төлсөн / төлөөгүй гэж ялгахад зориулав.
-- appointments-д үнэ + төлбөрийн төлөв нэмнэ. Бүгд idempotent.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- payment_status-д зөвшөөрөгдөх утгууд (constraint-ийг дахин найдвартай тавина)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_payment_status_check
  CHECK (payment_status IN ('paid', 'unpaid', 'partial'));

CREATE INDEX IF NOT EXISTS idx_appointments_shop_payment
  ON appointments(shop_id, payment_status);

COMMENT ON COLUMN appointments.price IS 'Уулзалтын үнэ (үйлчилгээний үнийн snapshot). NULL бол үнэгүй/тодорхойгүй.';
COMMENT ON COLUMN appointments.payment_status IS 'Төлбөрийн төлөв: paid (100% төлсөн) / unpaid / partial.';
