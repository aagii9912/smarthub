-- Add appointment type and fields for time booking services
-- Run this in Supabase SQL Editor

-- Extend product type to include 'appointment'
-- Note: type column already allows VARCHAR(20), so 'appointment' fits

-- Add appointment-specific columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'];
ALTER TABLE products ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '09:00';
ALTER TABLE products ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT '18:00';
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_bookings_per_day INTEGER DEFAULT 10;

-- Comment on columns
COMMENT ON COLUMN products.duration_minutes IS 'Duration of appointment in minutes (for type=appointment)';
COMMENT ON COLUMN products.available_days IS 'Available days for booking: mon, tue, wed, thu, fri, sat, sun';
COMMENT ON COLUMN products.start_time IS 'Start time of working hours';
COMMENT ON COLUMN products.end_time IS 'End time of working hours';
COMMENT ON COLUMN products.max_bookings_per_day IS 'Maximum number of bookings allowed per day';

-- Example usage:
-- Appointment: Массаж, type='appointment', duration_minutes=60, 
--              available_days=['mon','tue','wed','thu','fri'],
--              start_time='09:00', end_time='18:00', max_bookings_per_day=8

SELECT 'Appointment type columns added successfully! ✅' as result;
