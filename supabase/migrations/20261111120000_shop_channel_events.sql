-- shop_channel_events — дэлгүүрийн Facebook page / Instagram холболтын өөрчлөлтийн лог.
--
-- Яагаад: 2026-10-09-нд ИТО Монголиа дэлгүүрийн facebook_page_id/name/token
-- NULL болж, AI 33 хоног хариулаагүй. Хэн, аль замаар салгасныг тогтоох
-- ямар ч ул мөр байгаагүй (shops-д updated_at байхгүй, Vercel лог ~1 хоног).
--
-- Энэ migration:
--   1. shop_channel_events — append-only лог (connected / disconnected / changed).
--   2. shops.channel_change_context — апп UPDATE-тэй хамт "хэн, яагаад"-ыг
--      дамжуулдаг нэг удаагийн JSONB. Trigger уншаад шууд NULL болгоно
--      (хэзээ ч хадгалагдахгүй).
--   3. Trigger — facebook_page_id / instagram_business_account_id өөрчлөгдөх
--      БҮРД (API, SQL editor, ирээдүйн код — аль ч замаар) мөр бичнэ. Context
--      дамжуулаагүй бол source = NULL, db_role нь замыг илтгэнэ
--      (service_role = API, postgres = SQL editor).
--   4. orphan_alerted_at / orphan_alert_count — салгагдсан page-ээс webhook
--      ирсээр байвал эзэмшигч/admin-д 24 цагт нэг удаа, нийт 3 хүртэл
--      мэдэгдэх throttle (src/lib/shop/channelEvents.ts).
--
-- Лог бичих алдаа shops UPDATE-ийг ХЭЗЭЭ Ч зогсоохгүй (EXCEPTION → WARNING).
-- Бичих нь зөвхөн trigger + service role. Дэлгүүрийн баг зөвхөн уншина.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.shop_channel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  action TEXT NOT NULL CHECK (action IN ('connected', 'disconnected', 'changed')),
  old_account_id TEXT,
  new_account_id TEXT,
  old_account_name TEXT,
  new_account_name TEXT,
  -- 'owner_disconnect' | 'claimed_by_other_shop' | 'settings_update' | NULL (тодорхойгүй зам)
  source TEXT,
  actor_user_id TEXT,
  -- claimed_by_other_shop үед page-ийг авсан дэлгүүр
  related_shop_id UUID,
  db_role TEXT,
  orphan_alerted_at TIMESTAMPTZ,
  -- Нэг салгалтад хамгийн ихдээ 3 мэдэгдэл (өдөрт 1) — санаатай салгасан
  -- дэлгүүрийг үүрд спамдахгүй.
  orphan_alert_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_channel_events_shop
  ON public.shop_channel_events (shop_id, created_at DESC);

-- Webhook "No active shop found" үед тухайн page/IG ID-г хамгийн сүүлд
-- эзэмшиж байсан дэлгүүрийг хайна.
CREATE INDEX IF NOT EXISTS idx_shop_channel_events_old_account
  ON public.shop_channel_events (old_account_id, created_at DESC)
  WHERE old_account_id IS NOT NULL;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS channel_change_context JSONB;

COMMENT ON COLUMN public.shops.channel_change_context IS
  'Write-only, one-shot: app passes {source, actor_user_id, related_shop_id} with a page/IG UPDATE; log_shop_channel_change() reads it into shop_channel_events and resets it to NULL.';

CREATE OR REPLACE FUNCTION public.log_shop_channel_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx JSONB := NEW.channel_change_context;
  v_source TEXT;
  v_actor TEXT;
  v_related UUID;
  v_old_fb TEXT;
  v_new_fb TEXT;
  v_old_ig TEXT;
  v_new_ig TEXT;
BEGIN
  -- Context нь нэг удаагийнх: BEFORE UPDATE-д шууд цэвэрлэнэ.
  IF TG_OP = 'UPDATE' THEN
    NEW.channel_change_context := NULL;
  END IF;

  BEGIN
    v_source := ctx->>'source';
    v_actor := COALESCE(ctx->>'actor_user_id', auth.uid()::text);
    BEGIN
      v_related := NULLIF(ctx->>'related_shop_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_related := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
      v_old_fb := NULL;
      v_old_ig := NULL;
    ELSE
      v_old_fb := NULLIF(OLD.facebook_page_id, '');
      v_old_ig := NULLIF(OLD.instagram_business_account_id, '');
    END IF;
    v_new_fb := NULLIF(NEW.facebook_page_id, '');
    v_new_ig := NULLIF(NEW.instagram_business_account_id, '');

    IF v_old_fb IS DISTINCT FROM v_new_fb THEN
      INSERT INTO public.shop_channel_events (
        shop_id, platform, action,
        old_account_id, new_account_id, old_account_name, new_account_name,
        source, actor_user_id, related_shop_id, db_role
      ) VALUES (
        NEW.id, 'facebook',
        CASE WHEN v_old_fb IS NULL THEN 'connected'
             WHEN v_new_fb IS NULL THEN 'disconnected'
             ELSE 'changed' END,
        v_old_fb, v_new_fb,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.facebook_page_name END,
        NEW.facebook_page_name,
        v_source, v_actor, v_related, current_user
      );
    END IF;

    IF v_old_ig IS DISTINCT FROM v_new_ig THEN
      INSERT INTO public.shop_channel_events (
        shop_id, platform, action,
        old_account_id, new_account_id, old_account_name, new_account_name,
        source, actor_user_id, related_shop_id, db_role
      ) VALUES (
        NEW.id, 'instagram',
        CASE WHEN v_old_ig IS NULL THEN 'connected'
             WHEN v_new_ig IS NULL THEN 'disconnected'
             ELSE 'changed' END,
        v_old_ig, v_new_ig,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.instagram_username END,
        NEW.instagram_username,
        v_source, v_actor, v_related, current_user
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Лог бичихгүй байсан ч дэлгүүрийн UPDATE-ийг хэзээ ч бүү зогсоо.
    RAISE WARNING 'log_shop_channel_change failed for shop %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- UPDATE: BEFORE (context-ийг NEW-ээс цэвэрлэхийн тулд).
DROP TRIGGER IF EXISTS shops_channel_change_before_update ON public.shops;
CREATE TRIGGER shops_channel_change_before_update
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  WHEN (
    OLD.facebook_page_id IS DISTINCT FROM NEW.facebook_page_id
    OR OLD.instagram_business_account_id IS DISTINCT FROM NEW.instagram_business_account_id
    OR NEW.channel_change_context IS NOT NULL
  )
  EXECUTE FUNCTION public.log_shop_channel_change();

-- INSERT: AFTER (FK shop_channel_events.shop_id → shops мөр байх ёстой).
DROP TRIGGER IF EXISTS shops_channel_change_after_insert ON public.shops;
CREATE TRIGGER shops_channel_change_after_insert
  AFTER INSERT ON public.shops
  FOR EACH ROW
  WHEN (NEW.facebook_page_id IS NOT NULL OR NEW.instagram_business_account_id IS NOT NULL)
  EXECUTE FUNCTION public.log_shop_channel_change();

-- ── RLS (shop team read-only) ───────────────────────────────────────
-- shops.user_id нь TEXT тул auth.uid()::text (20260617000000_salon_staff.sql-ийн хэв маяг)
ALTER TABLE public.shop_channel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop team reads own channel events" ON public.shop_channel_events;
CREATE POLICY "Shop team reads own channel events"
  ON public.shop_channel_events FOR SELECT
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Verify after applying:
--   UPDATE public.shops SET channel_change_context = '{"source":"test"}' WHERE id = '<shop>';
--   SELECT channel_change_context FROM public.shops WHERE id = '<shop>';  -- → NULL
--   -- page ID-г өөрчлөхөд: SELECT * FROM public.shop_channel_events WHERE shop_id = '<shop>';
