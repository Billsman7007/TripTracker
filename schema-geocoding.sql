-- Add geocoding columns to locations table
-- Run this in Supabase SQL Editor

ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
