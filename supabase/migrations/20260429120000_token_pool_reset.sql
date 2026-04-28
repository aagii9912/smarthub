-- ============================================================
-- Per-user token pool: rolling 30-day reset RPCs.
--
-- The pool counter lives on subscriptions.tokens_used_in_period.
-- Per-shop counters (shops.token_usage_total) are kept in sync for
-- analytics/dashboard breakdowns but are NOT the authority for
-- quota gating.
-- ============================================================

CREATE OR REPLACE FUNCTION reset_user_token_pool_if_due(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_anchor TIMESTAMPTZ;
    v_used BIGINT;
    v_sub_id UUID;
BEGIN
    -- Lock the most recent active-or-trialing subscription for this user.
    SELECT id, period_anchor_at, tokens_used_in_period
    INTO v_sub_id, v_anchor, v_used
    FROM subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing', 'pending', 'past_due')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_sub_id IS NULL THEN
        RETURN 0;
    END IF;

    IF v_anchor IS NULL OR v_anchor < (NOW() - INTERVAL '30 days') THEN
        UPDATE subscriptions
           SET period_anchor_at = NOW(),
               tokens_used_in_period = 0,
               updated_at = NOW()
         WHERE id = v_sub_id;

        -- shops.user_id is TEXT (legacy from Clerk); cast the UUID parameter
        -- to text for the comparison.
        UPDATE shops
           SET token_usage_total = 0,
               token_usage_reset_at = NOW() + INTERVAL '30 days'
         WHERE user_id = p_user_id::text;

        RETURN 0;
    END IF;

    RETURN COALESCE(v_used, 0);
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_token_pool(
    p_user_id UUID,
    p_shop_id UUID,
    p_tokens BIGINT,
    p_feature TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_total BIGINT;
    v_sub_id UUID;
BEGIN
    -- Lazy reset before incrementing so the counter never overshoots a window.
    PERFORM reset_user_token_pool_if_due(p_user_id);

    SELECT id INTO v_sub_id
    FROM subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing', 'pending', 'past_due')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_sub_id IS NOT NULL THEN
        UPDATE subscriptions
           SET tokens_used_in_period = COALESCE(tokens_used_in_period, 0) + p_tokens,
               period_anchor_at = COALESCE(period_anchor_at, NOW()),
               updated_at = NOW()
         WHERE id = v_sub_id
        RETURNING tokens_used_in_period INTO v_new_total;
    ELSE
        v_new_total := 0;
    END IF;

    -- Per-shop analytics counter (best-effort; do not fail the call if missing).
    IF p_shop_id IS NOT NULL THEN
        UPDATE shops
           SET token_usage_total = COALESCE(token_usage_total, 0) + p_tokens,
               token_usage_reset_at = COALESCE(token_usage_reset_at, NOW() + INTERVAL '30 days')
         WHERE id = p_shop_id;

        BEGIN
            INSERT INTO shop_token_usage_daily (shop_id, usage_date, tokens_used)
            VALUES (p_shop_id, CURRENT_DATE, p_tokens)
            ON CONFLICT (shop_id, usage_date)
            DO UPDATE SET tokens_used = shop_token_usage_daily.tokens_used + EXCLUDED.tokens_used;
        EXCEPTION WHEN OTHERS THEN
            -- Daily table may not exist in older envs; non-fatal.
            NULL;
        END;
    END IF;

    RETURN COALESCE(v_new_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION reset_user_token_pool_if_due(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_user_token_pool(UUID, UUID, BIGINT, TEXT) TO service_role;
