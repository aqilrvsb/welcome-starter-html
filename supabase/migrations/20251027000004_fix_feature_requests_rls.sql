-- Fix RLS policies for feature_requests table to allow client and admin CRUD

-- Drop ALL existing policies on feature_requests
DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can create feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- ========================================
-- CLIENT POLICIES
-- ========================================

-- Allow users to view their own feature requests
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own feature requests
CREATE POLICY "Users can create feature requests"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own pending feature requests
CREATE POLICY "Users can update own pending requests"
  ON public.feature_requests
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'submitted');

-- ========================================
-- ADMIN POLICIES
-- ========================================

-- Allow admins to view all feature requests
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

-- Allow admins to insert feature requests (for creating roadmap items)
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

-- Allow admins to update any feature request
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
