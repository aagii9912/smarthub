-- ============================================
-- PRODUCT STATUS ENUM (Issue #8, #9, #10)
-- ============================================
-- Adds a unified `status` to products covering all the lifecycle states
-- the AI needs to differentiate between today:
--
--   draft        — Owner is still editing, AI must not surface it.
--   active       — Normally available; AI behaves as before.
--   pre_order    — Out of stock NOW but the AI can still take orders;
--                  customers are told the ETA.
--   coming_soon  — Not yet selling. AI can describe the product so
--                  interested customers know it's on the way.
--   discontinued — No longer offered. AI explicitly tells customers
--                  it's gone instead of saying "Дууссан".
--
-- Two ETA columns capture the upstream timing the AI needs:
--   available_from — When a coming_soon item becomes active.
--   pre_order_eta  — Expected restock date for a pre_order item.
--
-- Backfill respects the existing `is_active` boolean so nothing changes
-- for live shops on first deploy.
-- ============================================

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM (
        'draft',
        'active',
        'pre_order',
        'coming_soon',
        'discontinued'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS status product_status NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pre_order_eta TIMESTAMPTZ;

-- ADD COLUMN with NOT NULL DEFAULT already set every existing row to
-- 'active'. We only need to flip rows whose legacy `is_active` flag was
-- false so the AI hides them. The cast on the literal is required because
-- PostgreSQL won't auto-coerce a text expression into a custom ENUM.
UPDATE products
SET status = 'draft'::product_status
WHERE is_active = false AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_status
    ON products(shop_id, status);

CREATE INDEX IF NOT EXISTS idx_products_available_from
    ON products(available_from)
    WHERE status = 'coming_soon';
