-- Add DELETE and additional admin policies for better admin control

-- ========================================
-- FEATURE REQUESTS TABLE
-- ========================================

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- Allow admins to delete feature requests
CREATE POLICY "Admins can delete feature requests"
  ON public.feature_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- Allow admins to insert feature requests (for roadmap items)
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;

CREATE POLICY "Admins can insert feature requests"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- ========================================
-- SYSTEM SETTINGS TABLE
-- ========================================

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Admins can delete settings" ON public.system_settings;

-- Allow admins to delete system settings
CREATE POLICY "Admins can delete settings"
  ON public.system_settings
  FOR DELETE
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

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Admins can delete pro applications" ON public.pro_applications;

-- Allow admins to delete pro applications
CREATE POLICY "Admins can delete pro applications"
  ON public.pro_applications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );
