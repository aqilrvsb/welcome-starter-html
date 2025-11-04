-- Fix admin email to only use 'admin@gmail.com' in all RLS policies

-- Drop and recreate all admin policies with correct email

-- ========================================
-- FEATURE REQUESTS TABLE
-- ========================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;

-- Recreate with correct email (admin@gmail.com only)
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

CREATE POLICY "Admins can update all feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- ========================================
-- PRO APPLICATIONS TABLE
-- ========================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all pro applications" ON public.pro_applications;
DROP POLICY IF EXISTS "Admins can update all pro applications" ON public.pro_applications;

-- Recreate with correct email (admin@gmail.com only)
CREATE POLICY "Admins can view all pro applications"
  ON public.pro_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

CREATE POLICY "Admins can update all pro applications"
  ON public.pro_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- ========================================
-- SYSTEM SETTINGS TABLE
-- ========================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can read all settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;

-- Recreate with correct email (admin@gmail.com only)
CREATE POLICY "Admins can read all settings"
  ON public.system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

CREATE POLICY "Admins can insert settings"
  ON public.system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

CREATE POLICY "Admins can update settings"
  ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- ========================================
-- STORAGE BUCKET POLICIES
-- ========================================

-- Drop existing admin storage policy
DROP POLICY IF EXISTS "Admins can view all pro application documents" ON storage.objects;

-- Recreate with correct email (admin@gmail.com only)
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
