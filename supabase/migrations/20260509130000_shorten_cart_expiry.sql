-- =====================================================================
-- Cart expiry-г 24 цаг → 1 цаг болгож богиноруулах
-- =====================================================================
-- Хэрэглэгчийн чат session нь ердийдөө хэдхэн минут үргэлжилнэ. 24
-- цагийн default нь чатын session дунд нэмсэн хуучин cart items нь
-- "stale" хэвээр үлдэж шинэ checkout үед дахиж нийлэх асуудал үүсгэж
-- байсан. 1 цагийн window нь сэрэг сэгчилэхэд хангалттай ч дараагийн
-- захиалга шинэхэн эхлэхэд тохирно.
--
-- DEFAULT-ыг шинэ row-уудад хүчинтэй болгож, мөн одоогийн
-- `active` state-тэй cart-уудын `expires_at`-ыг 1 цаг болгож
-- буцаан хязгаарлана.
-- =====================================================================

ALTER TABLE carts
    ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '1 hour';

-- Backfill: одоо `active` бөгөөд expires_at нь 1 цагаас илүү хэтэрсэн
-- cart-уудыг 1 цаг болгож богиноруулна
UPDATE carts
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE status = 'active'
  AND expires_at > NOW() + INTERVAL '1 hour';

SELECT 'Cart expiry shortened from 24h to 1h ✅' as result;
