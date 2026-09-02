-- QPay хувь хүний merchant бүртгэлд шаардлагатай баганууд
-- Төлөвлөгөө: docs/plans/QPAY_MERCHANT_AND_UIUX_PLAN.md (A.4.1)
--
-- Хувь хүний merchant-д QPay овог/нэрийг тусад нь шаарддаг тул данс
-- эзэмшигчийн нэрийг зайгаар хуваах хуучин аргыг орлуулна. Мөн бүртгэлийн
-- алдааны шалтгаан, терминал ID, MCC/хаягийн кодыг хадгална.

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS owner_last_name TEXT,
    ADD COLUMN IF NOT EXISTS owner_first_name TEXT,
    ADD COLUMN IF NOT EXISTS qpay_merchant_type TEXT
        CHECK (qpay_merchant_type IS NULL OR qpay_merchant_type IN ('person', 'company')),
    ADD COLUMN IF NOT EXISTS qpay_mcc_code TEXT,
    ADD COLUMN IF NOT EXISTS qpay_city_code TEXT,
    ADD COLUMN IF NOT EXISTS qpay_district_code TEXT,
    ADD COLUMN IF NOT EXISTS qpay_p2p_terminal_id TEXT,
    ADD COLUMN IF NOT EXISTS qpay_card_terminal_id TEXT,
    ADD COLUMN IF NOT EXISTS qpay_last_error TEXT,
    ADD COLUMN IF NOT EXISTS qpay_registered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qpay_pending_since TIMESTAMPTZ;

COMMENT ON COLUMN shops.owner_last_name IS 'Merchant эзэмшигчийн овог (QPay person merchant last_name)';
COMMENT ON COLUMN shops.owner_first_name IS 'Merchant эзэмшигчийн нэр (QPay person merchant first_name)';
COMMENT ON COLUMN shops.qpay_merchant_type IS 'QPay merchant төрөл: person | company';
COMMENT ON COLUMN shops.qpay_mcc_code IS 'QPay Merchant Category Code (business_type-аас гаргасан)';
COMMENT ON COLUMN shops.qpay_last_error IS 'Сүүлийн QPay бүртгэлийн алдааны мессеж (failed төлөвт)';
COMMENT ON COLUMN shops.qpay_pending_since IS 'pending төлөвт орсон цаг — 10 минутаас хэтэрвэл failed болгоно';

-- Одоо active байгаа merchant-уудын төрлийг shops.merchant_type-аас нөхөж бичнэ
UPDATE shops
SET qpay_merchant_type = CASE WHEN merchant_type = 'company' THEN 'company' ELSE 'person' END
WHERE qpay_merchant_id IS NOT NULL AND qpay_merchant_type IS NULL;

-- pending төлөвт гацсан дэлгүүрүүдийг цэвэрлэх (cron-оос дуудна)
CREATE INDEX IF NOT EXISTS idx_shops_qpay_pending
    ON shops(qpay_pending_since) WHERE qpay_status = 'pending';
