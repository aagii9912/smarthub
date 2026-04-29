-- ============================================================
-- Token Daily History & Lite Plan setup
-- ============================================================

-- 1. Create table for daily token tracking
CREATE TABLE IF NOT EXISTS shop_token_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_used BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, usage_date)
);

-- Index for quick lookups by shop and date range
CREATE INDEX IF NOT EXISTS idx_shop_token_usage_daily ON shop_token_usage_daily (shop_id, usage_date);

-- Enable RLS
ALTER TABLE shop_token_usage_daily ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own shop's daily token usage
DROP POLICY IF EXISTS "Users can view their shop's daily usage" ON shop_token_usage_daily;
CREATE POLICY "Users can view their shop's daily usage"
    ON shop_token_usage_daily FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE user_id = (select auth.uid())::text
        )
    );

-- 2. Update increment_shop_token_usage function to also track daily usage
CREATE OR REPLACE FUNCTION increment_shop_token_usage(
    p_shop_id UUID,
    p_tokens BIGINT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current BIGINT;
    v_reset_at TIMESTAMPTZ;
    v_next_month TIMESTAMPTZ;
BEGIN
    -- Calculate next month boundary
    v_next_month := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- 1. Update daily usage table
    INSERT INTO shop_token_usage_daily (shop_id, usage_date, tokens_used)
    VALUES (p_shop_id, CURRENT_DATE, p_tokens)
    ON CONFLICT (shop_id, usage_date) 
    DO UPDATE SET 
        tokens_used = shop_token_usage_daily.tokens_used + p_tokens,
        updated_at = NOW();

    -- 2. Update total usage in shops table
    -- Get current values and hold lock
    SELECT token_usage_total, token_usage_reset_at
    INTO v_current, v_reset_at
    FROM shops WHERE id = p_shop_id
    FOR UPDATE;

    -- Auto-reset on month boundary
    IF v_reset_at IS NOT NULL AND v_reset_at <= NOW() THEN
        UPDATE shops SET
            token_usage_total = p_tokens,
            token_usage_reset_at = v_next_month
        WHERE id = p_shop_id;
        RETURN p_tokens;
    END IF;

    -- Normal increment
    UPDATE shops SET
        token_usage_total = COALESCE(token_usage_total, 0) + p_tokens,
        token_usage_reset_at = COALESCE(token_usage_reset_at, v_next_month)
    WHERE id = p_shop_id;

    RETURN COALESCE(v_current, 0) + p_tokens;
END;
$$;

-- 3. Add 'lite' plan to plans table if it does not exist
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, features, limits, sort_order)
SELECT 
    'Lite', 
    'lite', 
    'Lite хувилбар', 
    89000, 
    890000, 
    '{"messages_per_month": 1000, "shops_limit": 1, "ai_enabled": true, "comment_reply": false, "analytics": "basic", "priority_support": false}'::jsonb,
    '{"max_messages": 1000, "max_shops": 1, "max_products": 20, "max_customers": 50}'::jsonb,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM plans WHERE slug = 'lite'
);
