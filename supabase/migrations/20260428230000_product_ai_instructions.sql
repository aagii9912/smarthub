-- ============================================
-- PER-PRODUCT AI INSTRUCTIONS (Issue #2)
-- ============================================
-- Shop owners want to nudge how the AI talks about a SPECIFIC product
-- (e.g. "don't offer discounts on this", "always emphasise warranty",
-- "ask the customer's size before quoting"). Today the only training
-- surface is the shop-level `ai_instructions` column, which can't say
-- anything product-specific.
--
-- Adds an optional TEXT column to products. The runtime concatenates
-- shop-level + product-level into the system prompt; null/empty rows
-- contribute nothing.
-- ============================================

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS ai_instructions TEXT;
