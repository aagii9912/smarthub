-- Add notify_on_complaints toggle to shops table
-- Controls whether shop owners receive push notifications when a complaint is logged or status changes.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS notify_on_complaints BOOLEAN DEFAULT true;

COMMENT ON COLUMN shops.notify_on_complaints IS 'When true (default) shop receives push notifications for customer complaints and status changes';
