-- Migration: Bulk atomic stock reservation
-- Reserves stock for multiple products in a single transaction to eliminate N+1 queries
-- on order creation. Locks rows in product_id order to prevent deadlocks when two
-- concurrent orders touch the same products in different orders.

CREATE OR REPLACE FUNCTION reserve_stock_bulk(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item       RECORD;
    v_available  INT;
BEGIN
    -- Aggregate by product_id (same product may appear twice in one order) and
    -- iterate in a stable order to avoid deadlocks across concurrent callers.
    FOR v_item IN
        SELECT
            (elem->>'product_id')::uuid AS product_id,
            SUM((elem->>'quantity')::int) AS quantity
        FROM jsonb_array_elements(p_items) AS elem
        GROUP BY (elem->>'product_id')::uuid
        ORDER BY (elem->>'product_id')::uuid
    LOOP
        SELECT stock - COALESCE(reserved_stock, 0)
        INTO v_available
        FROM products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_available IS NULL THEN
            RAISE EXCEPTION 'product_not_found: %', v_item.product_id
                USING ERRCODE = 'P0002';
        END IF;

        IF v_available < v_item.quantity THEN
            RAISE EXCEPTION 'insufficient_stock: product=% available=% requested=%',
                v_item.product_id, v_available, v_item.quantity
                USING ERRCODE = 'P0001';
        END IF;

        UPDATE products
        SET
            reserved_stock = COALESCE(reserved_stock, 0) + v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.product_id;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_stock_bulk(JSONB) TO service_role;

COMMENT ON FUNCTION reserve_stock_bulk(JSONB) IS
'Atomically reserves stock for multiple products. Input: [{"product_id":"uuid","quantity":N}, ...]. Raises on missing product or insufficient stock.';
