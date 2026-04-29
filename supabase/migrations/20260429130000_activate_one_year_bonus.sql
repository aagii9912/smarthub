-- Activate the "1 жил төлж 2 жил" promotion seeded in 20260427110000_promotions.sql.
-- Idempotent: safe to re-run.

UPDATE promotions
SET
    is_active = true,
    starts_at = COALESCE(starts_at, NOW())
WHERE code = 'one_year_bonus';
