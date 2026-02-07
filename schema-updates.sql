-- Add missing fields to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_frequent BOOLEAN DEFAULT false;

-- Add missing fields to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS default_expense_type_id UUID REFERENCES expense_types(id) ON DELETE SET NULL;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'CAD'));
