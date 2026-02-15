-- Add vendor_id and receipt_id columns to misc_expenses
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE misc_expenses ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE misc_expenses ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;
ALTER TABLE misc_expenses ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_misc_expenses_vendor_id ON misc_expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_receipt_id ON misc_expenses(receipt_id);
