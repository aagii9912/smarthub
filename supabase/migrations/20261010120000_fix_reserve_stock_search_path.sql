-- Fix: reserve_stock fails with 42P01 `relation "products" does not exist`
--
-- 20260322145100_fix_linter_warnings.sql ran
--   ALTER FUNCTION public.reserve_stock(UUID, INT) SET search_path = '';
-- to silence the function_search_path_mutable linter warning, but the body
-- (20260322140000_atomic_stock_reservation.sql) referenced `products` without
-- a schema. With an empty search_path that name no longer resolves, so every
-- call errors out. In production this blocks every AI-created order
-- (createOrder.ts → "Үлдэгдэл хүрэлцэхгүй байна") and every reservation
-- adjust/release in updateOrder.ts.
--
-- Recreate the function with schema-qualified table names and keep
-- `SET search_path = ''` so the linter fix still holds. Logic is unchanged,
-- including the negative-quantity path the app uses to release a reservation.
--
-- CREATE OR REPLACE keeps the existing owner and grants; the GRANT below is
-- only there so this file is self-contained. Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.reserve_stock(p_product_id UUID, p_quantity INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    available_qty INT;
BEGIN
    -- Lock the row and check available stock atomically
    SELECT stock - COALESCE(reserved_stock, 0)
    INTO available_qty
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF available_qty IS NULL THEN
        RETURN FALSE; -- Product not found
    END IF;

    IF available_qty >= p_quantity THEN
        UPDATE public.products
        SET reserved_stock = COALESCE(reserved_stock, 0) + p_quantity
        WHERE id = p_product_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE; -- Not enough stock
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_stock(UUID, INT) TO service_role;

-- Verify after applying:
--   SELECT proconfig FROM pg_proc WHERE oid = 'public.reserve_stock(uuid, int)'::regprocedure;
--     → {"search_path=\"\""}
--   SELECT public.reserve_stock('<an existing products.id>', 0);
--     → true (reserves 0, so it changes nothing)
