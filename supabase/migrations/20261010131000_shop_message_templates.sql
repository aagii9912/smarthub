-- shop_message_templates — дэлгүүр бүрийн Meta Messenger Utility Message template.
--
-- Meta 2026-04-27-оос CONFIRMED_EVENT_UPDATE / POST_PURCHASE_UPDATE /
-- ACCOUNT_UPDATE message tag-ийг хассан (error 100). 24 цагийн цонхны гадна
-- захиалга/төлбөрийн мэдэгдэл илгээх цорын ганц зөвшөөрөгдсөн зам нь Page-ийн
-- өөрийн UTILITY template (permission: page_utility_messaging).
--
-- Template-ийн текст, параметрийн нэрийг код (src/lib/operator/utilityTemplates.ts)
-- тодорхойлно; энэ хүснэгт зөвхөн тухайн Page дээр үүсгэсэн template-ийн нэр,
-- хэл, Meta-гийн төлөвийг хадгална. Approved мөр байхгүй бол deliver()
-- эзэнд мэдэгдэл рүү буцна.
--
-- Бичих нь зөвхөн service role-оор (template үүсгэх API, webhook
-- `message_template_status_update`). Эзэн зөвхөн уншина.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.shop_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  template_name TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paused', 'disabled')),
  meta_template_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, purpose)
);

CREATE OR REPLACE FUNCTION public.set_shop_message_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_message_templates_updated_at_trg ON public.shop_message_templates;
CREATE TRIGGER shop_message_templates_updated_at_trg
  BEFORE UPDATE ON public.shop_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_message_templates_updated_at();

ALTER TABLE public.shop_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners read own message templates" ON public.shop_message_templates;
CREATE POLICY "Shop owners read own message templates"
  ON public.shop_message_templates FOR SELECT
  USING (
    -- shops.user_id нь TEXT тул auth.uid()::text (20260617000000_salon_staff.sql-ийн хэв маяг)
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND status = 'active')
  );
