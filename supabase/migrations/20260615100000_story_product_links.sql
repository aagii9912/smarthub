-- Story → Product registry
-- Maps an Instagram story (by reply_to.story.id) to a product so a story reply
-- ("авъя") resolves deterministically — no vision call, works on every plan,
-- and survives the story image CDN link expiring.
--
-- Facebook note: the FB Messenger webhook delivers NO story id/url when a user
-- replies to a Facebook Page Story (reply_to.story is Instagram-only — verified
-- against Meta docs + community thread 137663329229763). So FB rows are instead
-- a time-windowed "active pin": the owner marks "current story = product X" and
-- FB DMs received before `active_until` get that product as soft context.

CREATE TABLE IF NOT EXISTS public.story_product_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  platform TEXT NOT NULL DEFAULT 'instagram'
    CHECK (platform IN ('facebook', 'instagram')),

  -- IG: the reply_to.story.id value the webhook receives (deterministic key).
  -- FB: NULL — no story id is available, so FB rows use `active_until` instead.
  story_media_id TEXT,

  -- How the row was created. 'vision_auto' is the read-through cache write
  -- (the webhook upserts after a confident vision match so the next reply to
  -- the same story is free + deterministic).
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'vision_auto', 'cron_auto')),

  confidence NUMERIC,            -- set for auto rows, NULL for manual
  media_url TEXT,                -- snapshot of the story image (audit/UI)
  caption TEXT,

  -- FB active pin window. DMs received before this map to product_id.
  -- NULL for IG story_media_id rows (those resolve by id, not by time).
  active_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One product per IG story → O(1) deterministic webhook lookup. Partial so FB
-- pins (story_media_id IS NULL) are exempt and a shop can have many over time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_product_links_story
  ON public.story_product_links(shop_id, story_media_id)
  WHERE story_media_id IS NOT NULL;

-- Dashboard list (newest first).
CREATE INDEX IF NOT EXISTS idx_story_product_links_shop
  ON public.story_product_links(shop_id, created_at DESC);

-- FB active-pin lookup (latest non-expired pin per shop). created_at is included
-- so the `ORDER BY created_at DESC LIMIT 1` in getActiveFbPin is index-served.
CREATE INDEX IF NOT EXISTS idx_story_product_links_active_pin
  ON public.story_product_links(shop_id, platform, active_until, created_at DESC)
  WHERE active_until IS NOT NULL;

-- RLS
ALTER TABLE public.story_product_links ENABLE ROW LEVEL SECURITY;

-- DROP-then-CREATE so the whole script is safely re-runnable (CREATE POLICY has
-- no IF NOT EXISTS).
DROP POLICY IF EXISTS "Users can view own story_product_links" ON public.story_product_links;
CREATE POLICY "Users can view own story_product_links"
  ON public.story_product_links FOR SELECT
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own story_product_links" ON public.story_product_links;
CREATE POLICY "Users can insert own story_product_links"
  ON public.story_product_links FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "Users can update own story_product_links" ON public.story_product_links;
CREATE POLICY "Users can update own story_product_links"
  ON public.story_product_links FOR UPDATE
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own story_product_links" ON public.story_product_links;
CREATE POLICY "Users can delete own story_product_links"
  ON public.story_product_links FOR DELETE
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id = (SELECT auth.uid())::text
    )
  );

-- Service role full access for the webhook (read-through lookup + vision_auto upsert)
DROP POLICY IF EXISTS "Service role full access to story_product_links" ON public.story_product_links;
CREATE POLICY "Service role full access to story_product_links"
  ON public.story_product_links FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.story_product_links IS 'Maps a story (IG story_media_id, or FB time-windowed active pin) to a product for story-reply → product resolution';
COMMENT ON COLUMN public.story_product_links.story_media_id IS 'IG: reply_to.story.id (deterministic key). FB: NULL — FB webhook carries no story id';
COMMENT ON COLUMN public.story_product_links.source IS 'manual = owner-tagged, vision_auto = webhook read-through cache, cron_auto = pre-warm cron';
COMMENT ON COLUMN public.story_product_links.active_until IS 'FB active-pin window: DMs before this time map to product_id. NULL for IG rows';
