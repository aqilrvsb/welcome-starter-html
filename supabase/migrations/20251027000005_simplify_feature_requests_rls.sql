-- Simplify RLS policies for feature_requests to fix client insert issues

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can create feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- ========================================
-- SIMPLIFIED CLIENT POLICIES
-- ========================================

-- Allow authenticated users to view their own feature requests
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert feature requests
CREATE POLICY "Users can create feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own submitted requests
CREATE POLICY "Users can update own pending requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'submitted')
  WITH CHECK (auth.uid() = user_id AND status = 'submitted');

-- ========================================
-- ADMIN POLICIES - Using service role bypass
-- ========================================

-- Admins can view all (via service_role key in admin panel)
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.users
      WHERE email = 'admin@gmail.com'
    )
  );

-- Admins can insert (via service_role key in admin panel)
CREATE POLICY "Admins can insert feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users
      WHERE email = 'admin@gmail.com'
    )
  );

-- Admins can update all
CREATE POLICY "Admins can update all feature requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.users
      WHERE email = 'admin@gmail.com'
    )
  );

-- Admins can delete all
CREATE POLICY "Admins can delete feature requests"
  ON public.feature_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.users
      WHERE email = 'admin@gmail.com'
    )
  );
