-- Add the same permissive policy that other tables use

-- Drop all existing policies on feature_requests
DROP POLICY IF EXISTS "authenticated_insert" ON public.feature_requests;
DROP POLICY IF EXISTS "authenticated_select" ON public.feature_requests;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can create feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can insert feature requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete all" ON public.feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON public.feature_requests;

-- Create the same permissive policy as contacts, prompts, campaigns, etc.
CREATE POLICY "Allow all operations" ON public.feature_requests FOR ALL USING (true) WITH CHECK (true);

-- Also add for pro_applications and system_settings while we're at it
DROP POLICY IF EXISTS "Allow all operations" ON public.pro_applications;
CREATE POLICY "Allow all operations" ON public.pro_applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations" ON public.system_settings;
CREATE POLICY "Allow all operations" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
