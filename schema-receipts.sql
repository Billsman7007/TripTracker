-- Create receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  status TEXT DEFAULT 'unprocessed' CHECK (status IN ('unprocessed', 'processed', 'skipped')),
  receipt_type TEXT CHECK (receipt_type IN ('fuel', 'expense', 'repair')),
  linked_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_status ON receipts(tenant_id, status);

-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for receipts
CREATE POLICY "Users can view own tenant receipts" ON receipts
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own tenant receipts" ON receipts
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own tenant receipts" ON receipts
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tenant receipts" ON receipts
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Create storage bucket for receipts (run this in Supabase Dashboard > Storage > New Bucket)
-- Bucket name: receipts
-- Public: false
-- File size limit: 10 MB
-- Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
