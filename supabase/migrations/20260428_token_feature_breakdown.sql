-- ============================================================
-- Per-feature token usage breakdown
-- ============================================================
-- Adds the `feature` dimension to token tracking so shop owners
-- see WHAT consumed their tokens (chat, AI memo, vision, etc.),
-- not just a single total. Also adds opt-out flag for the new
-- weekly email digest.

-- 1. Lookup table for feature categories (data-driven legend)
CREATE TABLE IF NOT EXISTS token_feature_categories (
    key         TEXT PRIMARY KEY,
    label_mn    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    sort_order  INT  NOT NULL DEFAULT 100
);

-- Seed (kept in sync with src/lib/ai/tokenFeatures.ts)
INSERT INTO token_feature_categories (key, label_mn, label_en, sort_order) VALUES
    ('chat_reply',        'Чат хариулт',                 'Chat reply',           1),
    ('ai_memo',           'Хэрэглэгчийн тэмдэглэл',      'Customer memo',        2),
    ('vision',            'Зураг шинжилгээ',             'Image vision',         3),
    ('system_prompt_gen', 'Систем зааварчилга үүсгэх',  'System prompt gen',    4),
    ('product_parse',     'Бүтээгдэхүүн импорт',         'Product import',       5),
    ('lead_qualify',      'Lead шалгалт',                'Lead qualify',         6),
    ('comment_auto',      'Comment автомат хариулт',    'Comment automation',   7),
    ('tool_call',         'Function call',               'Tool call',            8),
    ('unknown_legacy',    'Өмнөх (задлаагүй)',           'Legacy uncategorized', 99)
ON CONFLICT (key) DO UPDATE SET
    label_mn   = EXCLUDED.label_mn,
    label_en   = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order;

-- 2. Add feature + call_count to daily breakdown
ALTER TABLE shop_token_usage_daily
    ADD COLUMN IF NOT EXISTS feature    TEXT NOT NULL DEFAULT 'unknown_legacy',
    ADD COLUMN IF NOT EXISTS call_count INT  NOT NULL DEFAULT 0;

-- Backfill: existing rows are honestly tagged 'unknown_legacy'
-- (writing 'chat_reply' would lie — vision/memo/etc. were silently mixed in).
UPDATE shop_token_usage_daily SET feature = 'unknown_legacy' WHERE feature IS NULL;

-- FK to lookup table (validates known categories without rigid CHECK)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shop_token_usage_daily_feature_fkey'
    ) THEN
        ALTER TABLE shop_token_usage_daily
            ADD CONSTRAINT shop_token_usage_daily_feature_fkey
            FOREIGN KEY (feature) REFERENCES token_feature_categories(key)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

-- Replace old (shop_id, usage_date) unique with (shop_id, usage_date, feature)
ALTER TABLE shop_token_usage_daily
    DROP CONSTRAINT IF EXISTS shop_token_usage_daily_shop_id_usage_date_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shop_token_usage_daily_uniq'
    ) THEN
        ALTER TABLE shop_token_usage_daily
            ADD CONSTRAINT shop_token_usage_daily_uniq
            UNIQUE (shop_id, usage_date, feature);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shop_token_usage_daily_feature
    ON shop_token_usage_daily (shop_id, feature, usage_date DESC);

-- 3. Email opt-out flag (default-on; shop owners care about cost transparency)
ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS token_report_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. Update increment_shop_token_usage to take feature + bump call_count
CREATE OR REPLACE FUNCTION increment_shop_token_usage(
    p_shop_id UUID,
    p_tokens  BIGINT,
    p_feature TEXT DEFAULT 'unknown_legacy'
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current    BIGINT;
    v_reset_at   TIMESTAMPTZ;
    v_next_month TIMESTAMPTZ;
    v_feature    TEXT;
BEGIN
    v_next_month := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- Coerce unknown feature keys to 'unknown_legacy' rather than failing the AI call
    SELECT key INTO v_feature FROM token_feature_categories WHERE key = p_feature;
    IF v_feature IS NULL THEN
        v_feature := 'unknown_legacy';
    END IF;

    -- 1. Daily breakdown row (per shop / day / feature)
    INSERT INTO shop_token_usage_daily (shop_id, usage_date, feature, tokens_used, call_count)
    VALUES (p_shop_id, CURRENT_DATE, v_feature, p_tokens, 1)
    ON CONFLICT (shop_id, usage_date, feature)
    DO UPDATE SET
        tokens_used = shop_token_usage_daily.tokens_used + p_tokens,
        call_count  = shop_token_usage_daily.call_count + 1,
        updated_at  = NOW();

    -- 2. Shop-level total (unchanged behavior)
    SELECT token_usage_total, token_usage_reset_at
    INTO v_current, v_reset_at
    FROM shops WHERE id = p_shop_id
    FOR UPDATE;

    IF v_reset_at IS NOT NULL AND v_reset_at <= NOW() THEN
        UPDATE shops SET
            token_usage_total = p_tokens,
            token_usage_reset_at = v_next_month
        WHERE id = p_shop_id;
        RETURN p_tokens;
    END IF;

    UPDATE shops SET
        token_usage_total = COALESCE(token_usage_total, 0) + p_tokens,
        token_usage_reset_at = COALESCE(token_usage_reset_at, v_next_month)
    WHERE id = p_shop_id;

    RETURN COALESCE(v_current, 0) + p_tokens;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_shop_token_usage(UUID, BIGINT, TEXT) TO service_role;

-- 5. Helper view for the dashboard breakdown (current period + last 30 days)
CREATE OR REPLACE VIEW v_shop_token_breakdown AS
SELECT
    d.shop_id,
    d.usage_date,
    d.feature,
    d.tokens_used,
    d.call_count,
    c.label_mn,
    c.label_en,
    c.sort_order
FROM shop_token_usage_daily d
JOIN token_feature_categories c ON c.key = d.feature;

-- RLS for lookup table (read-only for everyone; writes via service_role only)
ALTER TABLE token_feature_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'token_feature_categories' AND policyname = 'Anyone can read feature categories'
    ) THEN
        CREATE POLICY "Anyone can read feature categories"
            ON token_feature_categories FOR SELECT
            USING (true);
    END IF;
END $$;
