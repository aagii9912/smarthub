-- =====================================================================
-- Cash on Delivery (COD) дэмжлэг + хүргэлтийн дараа автомат төлбөр
-- =====================================================================
-- Монгол хэрэглэгчид төлбөрөө шууд төлөхгүй бөгөөд барааг хүргэгдсэний
-- дараа төлдөг. Энэ миграц нь:
--   1. orders.payment_method-д 'cod' гэсэн утгыг зөвшөөрнө
--   2. orders дээр delivered_at timestamp нэмнэ (auditing-д ашиглана)
--   3. Захиалгын статус 'delivered' болсны дараа COD төлбөрийн
--      бичлэгийг автоматаар 'paid' болгох trigger үүсгэнэ
--   4. orders.status='delivered' болоход COD захиалгын payment_status-г
--      шууд 'paid' болгож, paid_at-ийг тохируулна
-- =====================================================================

-- ── 1. orders дээр delivered_at нэмэх ──────────────────────────────────
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at)
    WHERE delivered_at IS NOT NULL;

-- ── 2. payment_method-ийн default-ийг 'cod' болгох (Монгол стандарт) ──
ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'cod';

-- ── 3. Захиалга delivered болоход payment_status-г шинэчлэх trigger ──
-- COD захиалга хүргэгдсэний дараа автоматаар paid гэж тэмдэглэгдэнэ.
-- Бусад payment_method (qpay, bank_transfer)-ийн хувьд энэ trigger
-- нөлөөлөхгүй — тэдгээр нь өмнө нь webhook эсвэл хэрэглэгчийн төлбөрөөр
-- баталгаажсан байх ёстой.
CREATE OR REPLACE FUNCTION update_payment_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    -- Зөвхөн status 'delivered' болж шинэчлэгдсэн үед ажиллана
    IF NEW.status = 'delivered'::order_status
       AND (OLD.status IS NULL OR OLD.status <> 'delivered'::order_status) THEN

        -- delivered_at-ийг тогтооно
        NEW.delivered_at := COALESCE(NEW.delivered_at, NOW());

        -- COD захиалгын хувьд автоматаар paid тэмдэглэнэ
        IF COALESCE(NEW.payment_method, 'cod') = 'cod'
           AND COALESCE(NEW.payment_status, 'pending') <> 'paid' THEN
            NEW.payment_status := 'paid';
            NEW.paid_at := COALESCE(NEW.paid_at, NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_on_delivery ON orders;
CREATE TRIGGER trigger_update_payment_on_delivery
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_on_delivery();

-- ── 4. orders.status шинэчлэгдсэний дараа payments-н бичлэгийг
--      синк хийх (хүргэлт амжилттай → COD payment-ийг paid болгох) ──
CREATE OR REPLACE FUNCTION sync_cod_payment_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered'::order_status
       AND (OLD.status IS NULL OR OLD.status <> 'delivered'::order_status)
       AND COALESCE(NEW.payment_method, 'cod') = 'cod' THEN

        UPDATE payments
        SET
            status = 'paid'::payment_status,
            paid_at = COALESCE(paid_at, NOW())
        WHERE order_id = NEW.id
          AND status = 'pending'::payment_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_cod_payment_on_delivery ON orders;
CREATE TRIGGER trigger_sync_cod_payment_on_delivery
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION sync_cod_payment_on_delivery();

-- ── 5. Анхны өгөгдөлд: payment_method=NULL байгаа захиалгуудыг 'cod'
--      болгож, бэлэн биш payment_status-г 'pending' болгоно ──────────
UPDATE orders
SET payment_method = 'cod'
WHERE payment_method IS NULL;

UPDATE orders
SET payment_status = 'pending'
WHERE payment_status IS NULL;

SELECT 'Cash on Delivery support enabled ✅' as result;
