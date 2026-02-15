-- Migration: Add type, notes, and expected_date fields to stops table
-- Run this in Supabase SQL Editor

-- Add type field (stop type: empty_start, pickup, stop, terminal, delivery, reposition)
ALTER TABLE stops 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('empty_start', 'pickup', 'stop', 'terminal', 'delivery', 'reposition'));

-- Add notes field for stop-specific notes
ALTER TABLE stops 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add expected_date field for scheduling
ALTER TABLE stops 
ADD COLUMN IF NOT EXISTS expected_date DATE;

-- Set default type for existing stops (you may want to update these manually)
UPDATE stops SET type = 'stop' WHERE type IS NULL;
