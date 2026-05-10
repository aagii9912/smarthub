-- =====================================================================
-- Дэлгүүр-түвшний хүргэлтийн бодлого
-- =====================================================================
-- Эзэн нь settings-аас 3 дүрэм тохируулна:
--   1. free_delivery_threshold: захиалгын дүн нь үүнээс дээш бол хүргэлт үнэгүй
--   2. ub_delivery_fee: УБ хотын дотор хүргэлтийн төлбөр
--   3. province_delivery_fee: УБ-аас гадуур (аймаг / орон нутаг) хүргэлтийн төлбөр
--   4. province_delivery_note: гадуур хэрэглэгчдэд харуулах тайлбар (заавал биш)
--
-- AI checkout flow-д хэрэглэгчийн хаягаас УБ эсвэл гадуур гэдгийг
-- илрүүлээд, тохирох төлбөрийг ашиглана. Free threshold нь нийт дүнгээс
-- хамаараад хүргэлтийг бүхэлд нь үнэгүй болгоно.
--
-- Default: бүх утга 0/null — одоогийн зан өөрчлөгдөхгүй
-- (per-product delivery_type/delivery_fee нь fallback-ийн үүрэгтэй).
-- =====================================================================

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS delivery_policy JSONB
    DEFAULT '{
        "free_delivery_threshold": null,
        "ub_delivery_fee": 0,
        "province_delivery_fee": 0,
        "province_delivery_note": null
    }'::jsonb;

UPDATE shops
SET delivery_policy = '{
    "free_delivery_threshold": null,
    "ub_delivery_fee": 0,
    "province_delivery_fee": 0,
    "province_delivery_note": null
}'::jsonb
WHERE delivery_policy IS NULL;

SELECT 'Shop delivery_policy column added ✅' as result;
