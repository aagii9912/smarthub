-- ============================================
-- SmartHub Clean Reset Script
-- ⚠️ АНХААРУУЛГА: Энэ нь БҮХ өгөгдлийг устгана!
-- ============================================

-- Drop all tables in reverse order (foreign keys анхаарч)
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS order_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_customer_stats() CASCADE;

SELECT 'All tables dropped successfully! Одоо 001_initial_schema.sql ажиллуулна уу.' as message;

