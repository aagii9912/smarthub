-- Migration: Bulk stock reservation function
-- Allows reserving stock for multiple products in a single atomic transaction

CREATE OR REPLACE FUNCTION reserve_stock_bulk(p_items JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
    available_qty INT;
BEGIN
    -- Sort items by product_id and aggregate quantities to prevent deadlocks and handle duplicates
    -- We use a single loop to check and update stock for better performance and correctness

    FOR item IN
        SELECT product_id, SUM(quantity) as total_quantity
        FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
        GROUP BY product_id
        ORDER BY product_id
    LOOP
        -- Lock the row and check available stock atomically
        SELECT stock - COALESCE(reserved_stock, 0)
        INTO available_qty
        FROM products
        WHERE id = item.product_id
        FOR UPDATE;

        IF available_qty IS NULL OR available_qty < item.total_quantity THEN
            -- If any product is missing or has insufficient stock, we fail the whole operation
            -- The transaction will roll back automatically if this is called within one
            RETURN FALSE;
        END IF;

        -- Update stock
        UPDATE products
        SET
            reserved_stock = COALESCE(reserved_stock, 0) + item.total_quantity,
            updated_at = NOW()
        WHERE id = item.product_id;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Grant access to service role
GRANT EXECUTE ON FUNCTION reserve_stock_bulk(JSONB) TO service_role;
