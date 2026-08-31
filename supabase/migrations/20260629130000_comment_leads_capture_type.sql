-- Comment Leads phase 2: distinguish automation-captured leads from "missed" ones.
--
-- A missed lead = a comment that left a phone number ("авна 99XXXXXX") but did
-- NOT match any active automation rule, so the shop never DM'd them. Surfacing
-- these tells the shop "you collected 30 numbers your rules didn't catch — go
-- contact them / add a keyword". Both kinds live in comment_leads; this column
-- separates them.

ALTER TABLE public.comment_leads
  ADD COLUMN IF NOT EXISTS capture_type TEXT NOT NULL DEFAULT 'automation'
    CHECK (capture_type IN ('automation', 'missed'));

-- The actionable set: missed leads (always phone-bearing) newest-first per shop.
CREATE INDEX IF NOT EXISTS idx_comment_leads_missed
  ON public.comment_leads(shop_id, created_at DESC)
  WHERE capture_type = 'missed';

COMMENT ON COLUMN public.comment_leads.capture_type IS
  'automation = a rule matched and DM''d the commenter; missed = phone left but no rule matched (uncaptured opportunity)';
