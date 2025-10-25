-- Create storage bucket for pro application documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pro-applications',
  'pro-applications',
  false, -- Not public, requires authentication
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pro-applications bucket

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload own pro application documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pro-applications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own documents
CREATE POLICY "Users can view own pro application documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pro-applications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own documents
CREATE POLICY "Users can update own pro application documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pro-applications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own pro application documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pro-applications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all pro application documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pro-applications' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.email = 'admin@gmail.com'
  )
);
