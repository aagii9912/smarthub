-- Enforce positive quantities on order_items (parity with the existing
-- cart_items `quantity > 0` CHECK). Without this, a bad insert/update could
-- persist zero/negative quantities and corrupt inventory + revenue math.
--
-- Defensive + idempotent: repairs any pre-existing non-positive rows (there
-- should be none, since quantity defaults to 1) before adding the constraint,
-- and no-ops if the constraint already exists.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_items_quantity_positive'
          AND conrelid = 'public.order_items'::regclass
    ) THEN
        -- Repair any non-positive / null quantities before enforcing.
        UPDATE public.order_items
        SET quantity = 1
        WHERE quantity IS NULL OR quantity < 1;

        ALTER TABLE public.order_items
            ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
    END IF;
END $$;
