-- AI-generated short memo per customer for the inbox pane.
-- Lets the dashboard show the store owner a quick context summary
-- before they read through the full chat history.

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ai_summary_message_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ai_summary_locale TEXT DEFAULT 'mn';

COMMENT ON COLUMN public.customers.ai_summary
    IS 'AI-generated 4-6 bullet memo summarizing the customer situation, in Mongolian by default.';
COMMENT ON COLUMN public.customers.ai_summary_message_count
    IS 'chat_history row count at the time ai_summary was generated; used to detect staleness.';
COMMENT ON COLUMN public.customers.ai_summary_locale
    IS 'Locale tag for the generated summary; defaults to mn.';

CREATE INDEX IF NOT EXISTS idx_customers_ai_summary_updated_at
    ON public.customers (shop_id, ai_summary_updated_at DESC NULLS LAST);
