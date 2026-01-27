-- Add Instagram integration fields to SmartHub
-- This migration adds support for Instagram Business Messaging API

-- Add Instagram fields to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Add Instagram fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'messenger';

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shops_instagram_id ON shops(instagram_business_account_id);
CREATE INDEX IF NOT EXISTS idx_customers_instagram_id ON customers(instagram_id);
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform);

-- Add comment for documentation
COMMENT ON COLUMN shops.instagram_business_account_id IS 'Instagram Business Account ID for webhook matching';
COMMENT ON COLUMN shops.instagram_access_token IS 'Instagram API access token';
COMMENT ON COLUMN shops.instagram_username IS 'Instagram username for display';
COMMENT ON COLUMN customers.instagram_id IS 'Instagram-scoped user ID';
COMMENT ON COLUMN customers.platform IS 'Source platform: messenger or instagram';
