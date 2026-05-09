-- ============================================================
-- Instagram Login flow support
--
-- Adds metadata columns so a single shop row can represent EITHER
-- the legacy Facebook-Login-Graph-API connection OR the newer
-- Instagram Login direct connection (60-day token, no FB Page).
--
-- 1. instagram_auth_type — discriminator. Defaults to 'facebook_login'
--    so every existing row keeps its original behaviour and no caller
--    needs to be aware of the new flow until it explicitly opts in.
-- 2. instagram_token_expires_at — populated by the IG-Login callback
--    (now() + 60d) and consumed by the daily refresh cron.
-- 3. instagram_token_revoked_at — set by the refresh cron when Meta
--    returns permission_denied / OAuth error. We never null the token
--    automatically — the user must explicitly re-connect — but we mark
--    the row so the UI can prompt for re-auth.
-- ============================================================

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS instagram_auth_type text
        NOT NULL DEFAULT 'facebook_login'
        CHECK (instagram_auth_type IN ('facebook_login', 'instagram_login')),
    ADD COLUMN IF NOT EXISTS instagram_token_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS instagram_token_revoked_at timestamptz;

-- Partial index so the refresh cron's range scan over near-expiring
-- IG-Login tokens stays cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_shops_ig_token_refresh
    ON shops (instagram_token_expires_at)
    WHERE instagram_auth_type = 'instagram_login'
        AND instagram_access_token IS NOT NULL
        AND instagram_token_revoked_at IS NULL;

COMMENT ON COLUMN shops.instagram_auth_type IS
    'OAuth flow used to connect Instagram: facebook_login (FB Page-attached IG via Graph API) or instagram_login (direct IG Business Login API, no FB Page).';
COMMENT ON COLUMN shops.instagram_token_expires_at IS
    'Long-lived IG-Login token expiry (~60 days). Refreshed daily by /api/cron/refresh-instagram-tokens. Null for facebook_login flow (page tokens do not expire on the same schedule).';
COMMENT ON COLUMN shops.instagram_token_revoked_at IS
    'Set when Meta returns permission_denied / OAuth error during refresh. Triggers re-auth prompt in the UI; cleared on successful re-connect.';
