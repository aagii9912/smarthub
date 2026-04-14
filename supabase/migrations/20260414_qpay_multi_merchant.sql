-- ============================================
-- QPay Multi-Merchant Integration Migration
-- Run in Supabase SQL Editor
-- Created: 2026-04-14
-- ============================================

-- 1. Add QPay merchant columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS qpay_merchant_id UUID,
ADD COLUMN IF NOT EXISTS qpay_bank_code TEXT,
ADD COLUMN IF NOT EXISTS qpay_account_number TEXT,
ADD COLUMN IF NOT EXISTS qpay_account_name TEXT,
ADD COLUMN IF NOT EXISTS qpay_status TEXT DEFAULT 'none' CHECK (qpay_status IN ('none', 'pending', 'active', 'failed'));

-- Index for merchant lookups
CREATE INDEX IF NOT EXISTS idx_shops_qpay_merchant_id 
ON shops(qpay_merchant_id) WHERE qpay_merchant_id IS NOT NULL;

-- 2. Add payment_type column to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'order' CHECK (payment_type IN ('order', 'subscription'));

-- 3. Add subscription payment tracking columns (if not exist)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS subscription_user_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan_slug TEXT;

-- Index for subscription payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_subscription 
ON payments(subscription_user_id, payment_type) WHERE payment_type = 'subscription';

COMMENT ON COLUMN shops.qpay_merchant_id IS 'QPay Quick Pay v2 merchant UUID - auto-registered';
COMMENT ON COLUMN shops.qpay_bank_code IS 'Bank code for QPay payments (e.g. 050000 = Khan bank)';
COMMENT ON COLUMN shops.qpay_status IS 'QPay merchant registration status';
COMMENT ON COLUMN payments.payment_type IS 'order = shop order, subscription = Syncly plan payment';
