-- CRM Enhancement: Add fields to customers table
-- Run this in Supabase SQL Editor

-- Add CRM-related columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(12,2) DEFAULT 0;

-- Create index for faster tag searches
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);

-- Create index for last_contact queries
CREATE INDEX IF NOT EXISTS idx_customers_last_contact ON customers (last_contact_at DESC);

-- Update existing customers: set last_contact_at from created_at if null
UPDATE customers SET last_contact_at = created_at WHERE last_contact_at IS NULL;

-- Calculate total_spent from existing orders
UPDATE customers c
SET total_spent = COALESCE((
    SELECT SUM(total_amount) 
    FROM orders o 
    WHERE o.customer_id = c.id AND o.status != 'cancelled'
), 0);

-- Create function to auto-update last_contact_at when chat happens
CREATE OR REPLACE FUNCTION update_customer_last_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers 
    SET last_contact_at = NOW() 
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chat_history
DROP TRIGGER IF EXISTS trigger_update_last_contact ON chat_history;
CREATE TRIGGER trigger_update_last_contact
    AFTER INSERT ON chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_last_contact();

-- Create function to auto-update total_spent when order is paid
CREATE OR REPLACE FUNCTION update_customer_total_spent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE customers 
        SET total_spent = total_spent + NEW.total_amount 
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for orders
DROP TRIGGER IF EXISTS trigger_update_total_spent ON orders;
CREATE TRIGGER trigger_update_total_spent
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_total_spent();
