-- Migration: Atomic and idempotent stock deduction
--
-- Replaces the SELECT-then-UPDATE pattern in StockService.deductStockForOrder
-- with a single transactional RPC. Idempotency is enforced via
-- orders.stock_deducted_at: the first call sets it, subsequent calls no-op.
--
-- Also drops trigger_decrement_stock_on_paid: stock deduction is now driven
-- exclusively from application code (single source of truth) via
-- atomic_claim_stock_deduction(). This removes the risk of double-deduction
-- when both the trigger and the webhook/manual-check paths fire.

-- 1. Idempotency marker on orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ;

-- 2. Drop the legacy status-based trigger (its semantics conflicted with the
--    canonical orders.status='confirmed' + payment_status='paid' used by webhook)
DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid ON orders;
DROP FUNCTION IF EXISTS decrement_stock_on_order_paid();

-- 3. Atomic, idempotent deduction RPC
CREATE OR REPLACE FUNCTION atomic_claim_stock_deduction(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claimed TIMESTAMPTZ;
    v_item    RECORD;
BEGIN
    -- Idempotency claim: only the first caller gets stock_deducted_at set.
    -- Subsequent callers see NOT FOUND because the WHERE clause excludes
    -- already-deducted rows.
    UPDATE orders
    SET stock_deducted_at = NOW()
    WHERE id = p_order_id
      AND stock_deducted_at IS NULL
    RETURNING stock_deducted_at INTO v_claimed;

    IF NOT FOUND THEN
        RETURN FALSE; -- already deducted (idempotent no-op)
    END IF;

    -- Aggregate and lock products in stable order to prevent deadlocks
    FOR v_item IN
        SELECT
            product_id,
            variant_id,
            SUM(quantity)::int AS qty
        FROM order_items
        WHERE order_id = p_order_id
        GROUP BY product_id, variant_id
        ORDER BY product_id, variant_id NULLS FIRST
    LOOP
        -- Acquire row lock on the product before updating
        PERFORM 1 FROM products WHERE id = v_item.product_id FOR UPDATE;

        UPDATE products
        SET
            stock = GREATEST(0, COALESCE(stock, 0) - v_item.qty),
            reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - v_item.qty),
            updated_at = NOW()
        WHERE id = v_item.product_id;

        -- Variant-level stock (mirrors the dropped trigger's behavior)
        IF v_item.variant_id IS NOT NULL THEN
            PERFORM 1 FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;

            UPDATE product_variants
            SET stock = GREATEST(0, COALESCE(stock, 0) - v_item.qty)
            WHERE id = v_item.variant_id;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_claim_stock_deduction(UUID) TO service_role;

COMMENT ON FUNCTION atomic_claim_stock_deduction(UUID) IS
'Idempotently deducts stock for an order in one transaction. Returns TRUE on first call, FALSE if already deducted. Replaces trigger_decrement_stock_on_paid.';
