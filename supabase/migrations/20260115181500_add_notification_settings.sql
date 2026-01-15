-- Add notification preference columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS notify_on_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_contact BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_support BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_cancel BOOLEAN DEFAULT true;

-- Update RLS if necessary (usually not needed if existing policies allow access to shops)
COMMENT ON COLUMN shops.notify_on_order IS 'Whether to send push notifications for new orders';
COMMENT ON COLUMN shops.notify_on_contact IS 'Whether to send push notifications for new contact information';
COMMENT ON COLUMN shops.notify_on_support IS 'Whether to send push notifications for human support requests';
COMMENT ON COLUMN shops.notify_on_cancel IS 'Whether to send push notifications for order cancellations';
