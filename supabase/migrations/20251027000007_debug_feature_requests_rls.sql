-- Debug and fix feature_requests RLS - Allow authenticated users to insert

-- Drop ALL policies
DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can create feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- TEMPORARY: Very permissive policy for testing
-- This allows ANY authenticated user to insert feature requests
CREATE POLICY "Allow authenticated users to insert"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- This will allow any authenticated user

-- Allow users to view their own
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users to update their own submitted requests
CREATE POLICY "Users can update own pending requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'submitted');

-- Admin policies
CREATE POLICY "Admins can view all"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = 'admin@gmail.com'
    )
  );

CREATE POLICY "Admins can update all"
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

CREATE POLICY "Admins can delete all"
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
