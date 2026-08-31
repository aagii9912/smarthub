-- Comment Leads: per-event log of comments captured by comment automations.
--
-- The `comment_automations` table only tracks an aggregate `trigger_count`, which
-- cannot answer "how many people / how many phone numbers did this automation
-- collect?". This table records one row per matched comment so the dashboard can
-- build a lead-collection report (live vs post, phones captured, funnel-to-order).
--
-- Mongolian buying pattern this serves: a shopper comments "авна" + their phone
-- number on a live/post, the automation DMs them, and they go straight to
-- delivery. The phone number is usually IN THE COMMENT, so we extract it here.

CREATE TABLE IF NOT EXISTS public.comment_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,

  -- Which automation captured this comment (null if the rule was later deleted).
  automation_id UUID REFERENCES public.comment_automations(id) ON DELETE SET NULL,

  -- Source
  platform TEXT NOT NULL                       -- 'facebook' | 'instagram'
    CHECK (platform IN ('facebook', 'instagram')),
  source_type TEXT NOT NULL DEFAULT 'post'     -- 'post' | 'live'
    CHECK (source_type IN ('post', 'live')),
  post_id TEXT,                                -- FB/IG post or media id the comment was on
  comment_id TEXT NOT NULL,                    -- Meta comment id (idempotency key)

  -- Who commented
  commenter_id TEXT,                           -- PSID / IG user id (from.id)
  commenter_name TEXT,                         -- from.name (best-effort, Meta may omit)
  comment_text TEXT,                           -- raw comment body
  extracted_phone TEXT,                        -- 8-digit MN number parsed from comment_text (null if none)
  matched_keyword TEXT,                        -- which trigger keyword fired

  -- What the automation did
  dm_sent BOOLEAN DEFAULT false,
  reply_sent BOOLEAN DEFAULT false,

  -- Funnel linkage (nullable; populated by future backfill — the report also
  -- derives conversion at read time by matching extracted_phone → orders).
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'           -- 'new' | 'contacted' | 'converted'
    CHECK (status IN ('new', 'contacted', 'converted')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- One lead per Meta comment. Webhooks are retried, so capture must be idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_leads_comment_id
  ON public.comment_leads(comment_id);

-- Report queries: list/aggregate a shop's leads over a date range.
CREATE INDEX IF NOT EXISTS idx_comment_leads_shop_created
  ON public.comment_leads(shop_id, created_at DESC);

-- Per-automation rollups.
CREATE INDEX IF NOT EXISTS idx_comment_leads_automation
  ON public.comment_leads(automation_id);

-- Funnel join by phone (only rows that actually captured a number).
CREATE INDEX IF NOT EXISTS idx_comment_leads_shop_phone
  ON public.comment_leads(shop_id, extracted_phone)
  WHERE extracted_phone IS NOT NULL;

-- RLS: shop owners read their own leads; webhook (service role) writes.
ALTER TABLE public.comment_leads ENABLE ROW LEVEL SECURITY;

-- DROP-before-CREATE: `CREATE POLICY` has no IF NOT EXISTS, so without this the
-- whole file fails on a second run (e.g. applied by hand in the SQL editor and
-- then again by `supabase db push`). Every other statement here is idempotent.
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

-- Comments
COMMENT ON TABLE public.comment_leads IS 'Per-comment lead log captured by comment automations (live + post), for the lead-collection report';
COMMENT ON COLUMN public.comment_leads.source_type IS 'post = comment on a normal post/reel, live = comment during a live broadcast (best-effort detection)';
COMMENT ON COLUMN public.comment_leads.extracted_phone IS '8-digit Mongolian phone parsed from the comment text (the "авна 99XXXXXX" pattern); null when no number present';
COMMENT ON COLUMN public.comment_leads.status IS 'Lead funnel stage; the report also derives conversion at read time by matching extracted_phone to orders';
