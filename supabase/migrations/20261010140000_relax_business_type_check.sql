-- shops.business_type CHECK-ийг жагсаалтаас формат шалгалт болгоно.
--
-- Салбарууд одоо кодын Industry Pack registry-д (src/lib/industry-packs/)
-- тодорхойлогддог бөгөөд зөвшөөрөгдсөн утгыг API (`isBusinessType`) шалгана.
-- Хуучин `IN (...)` жагсаалт нь шинэ pack бүрт migration шаардаж, кодтой
-- гараар sync хийх ёстой байсан (20260430110000_ai_agent_roles.sql).
-- Одоо DB зөвхөн утга нь pack id хэлбэртэй эсэхийг шалгана.
--
-- Одоо байгаа бүх 9 утга энэ хэлбэрт тохирно. Idempotent.

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_business_type_check;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_business_type_check
    CHECK (business_type IS NULL OR business_type ~ '^[a-z][a-z0-9_]{1,39}$');
