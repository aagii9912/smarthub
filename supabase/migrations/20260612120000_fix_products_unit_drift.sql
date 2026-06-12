-- Drift засвар: 20260113130005_add_product_type.sql түүхэнд "хэрэгжсэн" гэж
-- бүртгэлтэй ч live DB дээр products.unit багана үүсээгүй байсан
-- (импорт PGRST204 "Could not find the 'unit' column" алдаа өгч байв).
-- IF NOT EXISTS тул аль ч орчинд аюулгүй.

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'ширхэг';

-- ADD COLUMN ... DEFAULT нь хуучин мөрүүдийг 'ширхэг'-ээр дүүргэдэг тул
-- үйлчилгээний мөрүүдийг кодын default-тай ('захиалга') тааруулж нөхнө
UPDATE products SET unit = 'захиалга' WHERE type = 'service' AND (unit IS NULL OR unit = 'ширхэг');
UPDATE products SET unit = 'ширхэг' WHERE unit IS NULL;
