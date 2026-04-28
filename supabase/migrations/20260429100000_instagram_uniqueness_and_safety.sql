-- ============================================================
-- Instagram uniqueness & cross-user safety
-- 1. Drops the bogus `instagram_account_id` column if it ever existed.
-- 2. Resolves duplicates by NULLing IG fields on older shop rows.
-- 3. Adds a partial UNIQUE index so a single IG Business account
--    cannot be attached to two shops at once.
--
-- Note: shops has only created_at (no updated_at), so duplicate
-- resolution orders by created_at DESC.
-- ============================================================

ALTER TABLE shops DROP COLUMN IF EXISTS instagram_account_id;

WITH ranked AS (
    SELECT id,
           instagram_business_account_id,
           ROW_NUMBER() OVER (
               PARTITION BY instagram_business_account_id
               ORDER BY created_at DESC NULLS LAST
           ) AS rn
    FROM shops
    WHERE instagram_business_account_id IS NOT NULL
)
UPDATE shops s
SET instagram_business_account_id = NULL,
    instagram_access_token = NULL,
    instagram_username = NULL
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS idx_shops_instagram_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_instagram_business_account_id_unique
    ON shops (instagram_business_account_id)
    WHERE instagram_business_account_id IS NOT NULL;
