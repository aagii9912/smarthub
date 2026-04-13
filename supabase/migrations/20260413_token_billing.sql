-- ============================================================
-- Token-Based Billing Migration
-- Adds token usage tracking to shops table
-- ============================================================

-- 1. Add token usage columns to shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS token_usage_total BIGINT DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS token_usage_reset_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index for efficient billing queries
CREATE INDEX IF NOT EXISTS idx_shops_token_usage ON shops (token_usage_total) WHERE token_usage_total > 0;

-- 3. Atomic increment RPC function (with monthly auto-reset)
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

    -- Get current values
    SELECT token_usage_total, token_usage_reset_at
    INTO v_current, v_reset_at
    FROM shops WHERE id = p_shop_id
    FOR UPDATE; -- Row-level lock for atomicity

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

-- 4. Helper: Get token usage summary for a shop
CREATE OR REPLACE FUNCTION get_shop_token_usage(p_shop_id UUID)
RETURNS TABLE (
    total_tokens BIGINT,
    reset_at TIMESTAMPTZ,
    is_reset_needed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(s.token_usage_total, 0) AS total_tokens,
        s.token_usage_reset_at AS reset_at,
        (s.token_usage_reset_at IS NOT NULL AND s.token_usage_reset_at <= NOW()) AS is_reset_needed
    FROM shops s
    WHERE s.id = p_shop_id;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_shop_token_usage(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION get_shop_token_usage(UUID) TO service_role;
