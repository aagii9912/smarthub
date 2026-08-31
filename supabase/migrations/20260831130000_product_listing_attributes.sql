-- Зарын бүтэцлэгдсэн шинж чанар (үл хөдлөх / автомашин).
--
-- `business_type = 'realestate_auto'` дэлгүүрийн каталог нь ЗАР — байрыг өрөө,
-- талбай, дүүрэг, давхараар нь; машиныг марк, он, гүйлтээр нь тодорхойлдог.
-- Өмнө нь `products` дээрх цорын ганц бүтэцлэгдсэн нэмэлт нь `colors` ба
-- `sizes` (хувцасны) байсан тул эдгээр бүхэн чөлөөт `description` дотор
-- ордог байв. AI түүнийг уншиж чадах ч тоолох, шүүх, тайлагнах боломжгүй.
--
-- Хэлбэр (`src/lib/constants/listing-attributes.ts` нь цорын ганц эх сурвалж):
--   {"kind":"realestate","rooms":2,"area_m2":78,"district":"ХУД",
--    "khoroo":"11-р хороо","floor":5,"total_floors":12,"built_year":2019,
--    "is_furnished":true,"mortgage_available":true}
--   {"kind":"auto","make":"Toyota","model":"Prius 30","year":2015,
--    "mileage_km":145000,"engine_cc":1800,"transmission":"автомат",
--    "fuel":"хайбрид","steering":"зөв (зүүн)","color":"цагаан"}
--
-- Хэлбэрийг DB-д хатууруулаагүй (зөвхөн `kind`-ыг шалгана): шинэ талбар нэмэх
-- бүрд migration бичих шаардлагагүй байхаар app-level Zod-оор баталгаажуулна.
-- Бусад бизнесийн төрөлд энэ багана `{}` хэвээр үлдэнэ.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- `kind` байвал зөвхөн мэдэгдэж буй хоёрын нэг байх ёстой. Хоосон `{}` (өөр
-- бизнесийн төрлийн бүх бараа) зөвшөөрөгдөнө.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_attributes_kind_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_attributes_kind_check
      CHECK (
        NOT (attributes ? 'kind')
        OR attributes ->> 'kind' IN ('realestate', 'auto')
      );
  END IF;
END $$;

-- Шүүлт / тайлан: "ХУД-д байгаа 2 өрөө байрууд", "2015 оноос хойшхи Toyota".
-- jsonb_path_ops нь `@>` (contains) хайлтад зориулагдсан, ердийн GIN-ээс
-- мэдэгдэхүйц бага зайтай.
CREATE INDEX IF NOT EXISTS idx_products_attributes
  ON public.products USING GIN (attributes jsonb_path_ops)
  WHERE attributes <> '{}'::jsonb;

COMMENT ON COLUMN public.products.attributes IS
  'Зарын бүтэцлэгдсэн шинж чанар (зөвхөн realestate_auto). kind=realestate|auto; талбарын жагсаалт src/lib/constants/listing-attributes.ts дотор.';
