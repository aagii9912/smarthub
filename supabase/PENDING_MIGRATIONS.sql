-- ============================================================================
-- Syncly — хүлээгдэж буй migration-ууд (Supabase SQL Editor-т хуулж тавих)
-- ============================================================================
--
-- Энэ файл нь ДООРХ 4 migration-ыг нэг дор, дарааллаар нь агуулна:
--   1. 20260629120000_comment_leads.sql
--   2. 20260629130000_comment_leads_capture_type.sql
--   3. 20260831120000_customers_phone_lookup_index.sql
--   4. 20260831130000_product_listing_attributes.sql
--
-- ⚠️  Энэ бол migration ФАЙЛ БИШ — `supabase/` дотор байгаа тул
--     `supabase db push` үүнийг авахгүй. Зөвхөн гараар хуулах зориулалттай.
--
-- Хэрхэн ажиллуулах:
--   Supabase Dashboard → SQL Editor → New query → бүгдийг хуулж тавиад → Run
--
-- Бүх мэдэгдэл ИДЕМПОТЕНТ: хэдэн ч удаа ажиллуулж болно, аль хэдийн
-- тавигдсан хэсгүүд алгасагдана. Юу ч устгахгүй, өгөгдөл алдагдахгүй.
--
-- Хамрах хүрээ: 1 шинэ хүснэгт (comment_leads), 2 шинэ багана (capture_type,
-- products.attributes), 7 индекс, 1 CHECK, 2 RLS policy.
-- Байгаа хүснэгт/өгөгдөлд халдахгүй, юу ч устгахгүй.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0. УРЬДЧИЛСАН ШАЛГАЛТ — юу байгааг харна (юу ч өөрчлөхгүй)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Эхлээд ЗӨВХӨН энэ хэсгийг ажиллуулж, юу дутуу байгааг хараарай.

SELECT
  to_regclass('public.comment_leads')                  IS NOT NULL AS has_comment_leads_table,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'comment_leads'
            AND column_name  = 'capture_type')          AS has_capture_type_column,
  to_regclass('public.idx_customers_shop_phone')       IS NOT NULL AS has_customers_phone_index,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'products'
            AND column_name  = 'attributes')            AS has_product_attributes;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. comment_leads хүснэгт                                                 ║
-- ║    (20260629120000_comment_leads.sql)                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Сэтгэгдэл бүрийг нэг мөрөөр бүртгэнэ. `comment_automations` нь зөвхөн нийт
-- `trigger_count`-той тул "хэдэн хүн / хэдэн утас цуглуулсан бэ?" гэдэгт
-- хариулж чаддаггүй. Монголын худалдан авалтын хэв маяг: live/пост дор
-- "авна 99XXXXXX" гэж бичдэг — утас нь САНАЛ ДОТРОО байдаг тул энд задлана.

CREATE TABLE IF NOT EXISTS public.comment_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,

  -- Аль автомат дүрэм барьсан (дүрэм дараа устгагдвал null).
  automation_id UUID REFERENCES public.comment_automations(id) ON DELETE SET NULL,

  -- Эх сурвалж
  platform TEXT NOT NULL                       -- 'facebook' | 'instagram'
    CHECK (platform IN ('facebook', 'instagram')),
  source_type TEXT NOT NULL DEFAULT 'post'     -- 'post' | 'live'
    CHECK (source_type IN ('post', 'live')),
  post_id TEXT,                                -- FB/IG пост эсвэл media id
  comment_id TEXT NOT NULL,                    -- Meta comment id (давхардлын түлхүүр)

  -- Хэн бичсэн
  commenter_id TEXT,                           -- PSID / IG user id (from.id)
  commenter_name TEXT,                         -- from.name (Meta заримдаа өгдөггүй)
  comment_text TEXT,                           -- сэтгэгдлийн эх бичвэр
  extracted_phone TEXT,                        -- задалсан 8 оронтой дугаар (байхгүй бол null)
  matched_keyword TEXT,                        -- аль түлхүүр үг ажилласан

  -- Автомат юу хийсэн
  dm_sent BOOLEAN DEFAULT false,
  reply_sent BOOLEAN DEFAULT false,

  -- Юүнэлийн холбоос (nullable)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'           -- 'new' | 'contacted' | 'converted'
    CHECK (status IN ('new', 'contacted', 'converted')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Нэг Meta сэтгэгдэлд нэг мөр. Webhook дахин илгээгддэг тул заавал идемпотент.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_leads_comment_id
  ON public.comment_leads(comment_id);

-- Тайлангийн хайлт: дэлгүүрийн лидүүдийг хугацаагаар.
CREATE INDEX IF NOT EXISTS idx_comment_leads_shop_created
  ON public.comment_leads(shop_id, created_at DESC);

-- Дүрэм тус бүрийн нэгтгэл.
CREATE INDEX IF NOT EXISTS idx_comment_leads_automation
  ON public.comment_leads(automation_id);

-- Утсаар холбох (зөвхөн дугаар барьсан мөрүүд).
CREATE INDEX IF NOT EXISTS idx_comment_leads_shop_phone
  ON public.comment_leads(shop_id, extracted_phone)
  WHERE extracted_phone IS NOT NULL;

-- RLS: дэлгүүрийн эзэн өөрийнхөө лидийг уншина; webhook (service role) бичнэ.
ALTER TABLE public.comment_leads ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY-д IF NOT EXISTS байхгүй тул эхлээд DROP — эс бол дахин
-- ажиллуулахад бүх файл уначихна.
DROP POLICY IF EXISTS "Users can view own comment_leads" ON public.comment_leads;
CREATE POLICY "Users can view own comment_leads"
  ON public.comment_leads FOR SELECT
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "Service role full access to comment_leads" ON public.comment_leads;
CREATE POLICY "Service role full access to comment_leads"
  ON public.comment_leads FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.comment_leads IS 'Per-comment lead log captured by comment automations (live + post), for the lead-collection report';
COMMENT ON COLUMN public.comment_leads.source_type IS 'post = comment on a normal post/reel, live = comment during a live broadcast (best-effort detection)';
COMMENT ON COLUMN public.comment_leads.extracted_phone IS '8-digit Mongolian phone parsed from the comment text (the "авна 99XXXXXX" pattern); null when no number present';
COMMENT ON COLUMN public.comment_leads.status IS 'Lead funnel stage; the report also derives conversion at read time by matching extracted_phone to orders';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. capture_type — "барьсан" ба "алдсан" лидийг ялгах                     ║
-- ║    (20260629130000_comment_leads_capture_type.sql)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Алдсан лид = утсаа үлдээсэн ("авна 99XXXXXX") ч ямар ч дүрэмд ороогүй тул
-- дэлгүүр DM илгээгээгүй сэтгэгдэл. Эдгээрийг харуулах нь "чи 30 дугаар
-- алдсан байна — очиж холбогд / түлхүүр үг нэм" гэж хэлдэг.

ALTER TABLE public.comment_leads
  ADD COLUMN IF NOT EXISTS capture_type TEXT NOT NULL DEFAULT 'automation'
    CHECK (capture_type IN ('automation', 'missed'));

-- Ажиллах ёстой жагсаалт: алдсан лидүүд (үргэлж утастай), шинэ нь эхэндээ.
CREATE INDEX IF NOT EXISTS idx_comment_leads_missed
  ON public.comment_leads(shop_id, created_at DESC)
  WHERE capture_type = 'missed';

COMMENT ON COLUMN public.comment_leads.capture_type IS
  'automation = a rule matched and DM''d the commenter; missed = phone left but no rule matched (uncaptured opportunity)';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. customers.phone хайлтын индекс                                        ║
-- ║    (20260831120000_customers_phone_lookup_index.sql)                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Хоёр зам утсаар харилцагч хайдаг болсон:
--   1) `recordCommentLead` — сэтгэгдлээс барьсан утсыг байгаа харилцагчтай
--      тааруулна. WEBHOOK-ИЙН ХАЛУУН ЗАМД, live үед секундэд олон удаа.
--   2) `POST /api/dashboard/customers` — гараар лид нэмэхэд давхардал шалгана.
-- `customers.phone` дээр урьд нь ямар ч индекс байгаагүй.

CREATE INDEX IF NOT EXISTS idx_customers_shop_phone
  ON public.customers (shop_id, phone)
  WHERE phone IS NOT NULL;

COMMENT ON INDEX public.idx_customers_shop_phone IS
  'Comment-lead → customer тааруулалт болон гараар лид нэмэх үеийн давхардлын шалгалт (shop_id + phone тэнцүү хайлт).';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Migration бүртгэл — `supabase db push` дахин оролдохоос сэргийлнэ      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SQL Editor-оор гараар тавибал Supabase-ийн migration бүртгэлд тэмдэглэгддэггүй,
-- тул дараа `supabase db push` хийхэд эдгээрийг ДАХИН тавихыг оролдоно.
-- Дээрх бүх мэдэгдэл идемпотент тул уначихгүй ч, шууд "тавигдсан" гэж
-- тэмдэглэсэн нь цэвэрхэн.
--
-- Хэрэв чи зөвхөн `supabase db push` ашигладаг бол ЭНЭ ХЭСГИЙГ БҮҮ АЖИЛЛУУЛ —
-- CLI өөрөө бүртгэнэ.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3b. products.attributes — зарын бүтэцлэгдсэн шинж чанар                  ║
-- ║     (20260831130000_product_listing_attributes.sql)                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Үл хөдлөх / автын зарыг өрөө, талбай, дүүрэг, давхар / марк, он, гүйлтээр
-- нь тодорхойлно. Өмнө нь `products` дээрх цорын ганц бүтэцлэгдсэн нэмэлт нь
-- `colors`/`sizes` (хувцасны) байсан тул эдгээр бүхэн чөлөөт description дотор
-- ордог, тоолох/шүүх боломжгүй байв.
--
-- Хэлбэр (`src/lib/constants/listing-attributes.ts` = цорын ганц эх сурвалж):
--   {"kind":"realestate","rooms":2,"area_m2":78,"district":"ХУД","floor":5,
--    "total_floors":12,"built_year":2019,"is_furnished":true}
--   {"kind":"auto","make":"Toyota","model":"Prius 30","year":2015,
--    "mileage_km":145000,"transmission":"автомат"}
--
-- DB нь зөвхөн `kind`-ыг шалгана; бүрэн хэлбэрийг app-level Zod баталгаажуулна
-- (шинэ талбар нэмэх бүрд migration бичихгүйн тулд). Бусад бизнесийн төрөлд
-- энэ багана `{}` хэвээр үлдэнэ.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

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
CREATE INDEX IF NOT EXISTS idx_products_attributes
  ON public.products USING GIN (attributes jsonb_path_ops)
  WHERE attributes <> '{}'::jsonb;

COMMENT ON COLUMN public.products.attributes IS
  'Зарын бүтэцлэгдсэн шинж чанар (зөвхөн realestate_auto). kind=realestate|auto; талбарын жагсаалт src/lib/constants/listing-attributes.ts дотор.';


-- Бүртгэлийн хүснэгт байхгүй бол (CLI-г хэзээ ч ашиглаагүй төсөл) чимээгүй
-- алгасна — үүнээс болж бүх скрипт уначих ёсгүй.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260629120000'), ('20260629130000'), ('20260831120000'), ('20260831130000')
    ON CONFLICT (version) DO NOTHING;
  ELSE
    RAISE NOTICE 'supabase_migrations.schema_migrations олдсонгүй — бүртгэл алгаслаа.';
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. БАТАЛГААЖУУЛАЛТ — бүгд 'true' байх ёстой                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  to_regclass('public.comment_leads')                  IS NOT NULL AS comment_leads_table_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'comment_leads'
            AND column_name  = 'capture_type')          AS capture_type_column_ok,
  to_regclass('public.uq_comment_leads_comment_id')    IS NOT NULL AS unique_comment_id_ok,
  to_regclass('public.idx_comment_leads_missed')       IS NOT NULL AS missed_index_ok,
  to_regclass('public.idx_customers_shop_phone')       IS NOT NULL AS customers_phone_index_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'products'
            AND column_name  = 'attributes')            AS product_attributes_column_ok,
  to_regclass('public.idx_products_attributes')        IS NOT NULL AS product_attributes_index_ok,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_leads') = 2 AS rls_policies_ok;
