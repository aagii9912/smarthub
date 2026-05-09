-- =====================================================================
-- Shop-level accepted payment methods
-- =====================================================================
-- Дэлгүүр бүр өөрийн зөвшөөрсөн төлбөрийн хэлбэрүүдийг тохируулах
-- боломжтой болгоно. AI checkout flow эдгээр сонголтуудыг хүндэтгэн
-- хэрэглэгчид зөвхөн идэвхтэй сонголтуудыг харуулна.
--
-- JSONB: { "cod": bool, "qpay": bool, "bank_transfer": bool }
-- Default: бүгд true (хамгийн уян хатан) — дэлгүүрийн эзэн өөрөө
-- хүсэхгүй сонголтуудыг unti чичх боломжтой.
-- =====================================================================

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS accepted_payment_methods JSONB
    DEFAULT '{"cod": true, "qpay": true, "bank_transfer": true}'::jsonb;

-- Backfill: одоогийн дэлгүүрүүдийн NULL-уудыг бөглөнө
UPDATE shops
SET accepted_payment_methods = '{"cod": true, "qpay": true, "bank_transfer": true}'::jsonb
WHERE accepted_payment_methods IS NULL;

SELECT 'Shop accepted_payment_methods column added ✅' as result;
