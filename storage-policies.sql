-- Storage policies for the "receipts" bucket
-- Run this in Supabase Dashboard > SQL Editor AFTER creating the bucket

-- Allow authenticated users to upload receipt images
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to view/download receipt images
CREATE POLICY "Authenticated users can view receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts');

-- Allow authenticated users to update receipt images
CREATE POLICY "Authenticated users can update receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'receipts');

-- Allow authenticated users to delete receipt images
CREATE POLICY "Authenticated users can delete receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts');
