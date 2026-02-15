-- Add sequence columns to settings table
-- Run in Supabase SQL Editor

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS trip_number_sequence INTEGER DEFAULT 100;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS order_number_sequence INTEGER DEFAULT 1;

-- Set default for existing rows
UPDATE settings SET trip_number_sequence = 100 WHERE trip_number_sequence IS NULL;
UPDATE settings SET order_number_sequence = 1 WHERE order_number_sequence IS NULL;
