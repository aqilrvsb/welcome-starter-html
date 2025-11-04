-- Fix client-side feature requests with more permissive policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can create feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- ========================================
-- CLIENT POLICIES - SIMPLIFIED
-- ========================================

-- Allow any authenticated user to view feature requests they created
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow any authenticated user to create feature requests
-- IMPORTANT: No complex checks, just verify they're logged in
CREATE POLICY "Users can create feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to update only their submitted requests
CREATE POLICY "Users can update own pending requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'submitted');

-- ========================================
-- ADMIN POLICIES
-- ========================================

-- Allow admins to view all feature requests
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
    OR user_id = auth.uid() -- Also allow users to see their own
  );

-- Allow admins to insert feature requests
CREATE POLICY "Admins can insert feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- Allow admins to update any feature request
CREATE POLICY "Admins can update all feature requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

-- Allow admins to delete feature requests
CREATE POLICY "Admins can delete feature requests"
  ON public.feature_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );
