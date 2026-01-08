-- Auto-tagging SQL functions for CRM
-- Run this in Supabase SQL Editor

-- Function to auto-tag VIP customers (spent > 500,000₮)
CREATE OR REPLACE FUNCTION auto_tag_vip_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- If total_spent reaches VIP threshold
    IF NEW.total_spent >= 500000 AND NOT (NEW.tags @> '["VIP"]'::jsonb) THEN
        NEW.tags = NEW.tags || '["VIP"]'::jsonb;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto VIP tagging
DROP TRIGGER IF EXISTS trigger_auto_vip ON customers;
CREATE TRIGGER trigger_auto_vip
    BEFORE UPDATE ON customers
    FOR EACH ROW
    WHEN (NEW.total_spent IS DISTINCT FROM OLD.total_spent)
    EXECUTE FUNCTION auto_tag_vip_customer();

-- Function to tag new customers
CREATE OR REPLACE FUNCTION tag_new_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Add "New" tag to newly created customers
    NEW.tags = '["New"]'::jsonb;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new customer tagging
DROP TRIGGER IF EXISTS trigger_new_customer ON customers;
CREATE TRIGGER trigger_new_customer
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION tag_new_customer();

-- Scheduled function to tag inactive customers (no contact > 30 days)
-- This should be run periodically via Supabase Edge Function or cron
CREATE OR REPLACE FUNCTION tag_inactive_customers()
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET tags = tags || '["Inactive"]'::jsonb
    WHERE 
        last_contact_at < NOW() - INTERVAL '30 days'
        AND NOT (tags @> '["Inactive"]'::jsonb)
        AND last_contact_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Remove "New" tag when customer makes first purchase
CREATE OR REPLACE FUNCTION remove_new_tag_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    -- Remove "New" tag when first order is made
    IF NEW.total_orders = 1 AND OLD.total_orders = 0 THEN
        UPDATE customers
        SET tags = tags - 'New'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_remove_new_on_purchase ON customers;
CREATE TRIGGER trigger_remove_new_on_purchase
    AFTER UPDATE ON customers
    FOR EACH ROW
    WHEN (NEW.total_orders IS DISTINCT FROM OLD.total_orders)
    EXECUTE FUNCTION remove_new_tag_on_purchase();

-- Run once: Tag existing inactive customers
SELECT tag_inactive_customers();
