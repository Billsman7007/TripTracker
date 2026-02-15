-- Migration: Add expected_time to stops table
-- Run this in Supabase SQL Editor
-- Stores time as HH:MM 24h (e.g. "14:30") - optional, separate from expected_date

ALTER TABLE stops
ADD COLUMN IF NOT EXISTS expected_time TEXT;
