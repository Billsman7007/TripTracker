-- Add missing columns to expense_types table
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE expense_types ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE expense_types ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expense_types ADD COLUMN IF NOT EXISTS export_code TEXT;

-- Add unique constraint on code per tenant (so codes don't duplicate within a company)
-- Only apply if code is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_types_tenant_code
  ON expense_types(tenant_id, code) WHERE code IS NOT NULL;
