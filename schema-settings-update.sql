-- Add billing address and country of operation to settings table
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE settings ADD COLUMN IF NOT EXISTS billing_address1 TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS billing_address2 TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS billing_city TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS billing_state TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS billing_zip TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS country_of_operation TEXT DEFAULT 'US' CHECK (country_of_operation IN ('US', 'CA', 'BOTH'));
