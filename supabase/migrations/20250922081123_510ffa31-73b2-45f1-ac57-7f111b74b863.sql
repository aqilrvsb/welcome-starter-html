-- Drop the existing policies that reference auth.uid() (won't work with custom auth)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;

-- Create new policies that work with custom auth
-- For users table - allow public access for signup/login operations
CREATE POLICY "Public can read users for login" 
ON public.users 
FOR SELECT 
USING (true);

CREATE POLICY "Public can create users for signup" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update users for password change" 
ON public.users 
FOR UPDATE 
USING (true);

-- For user_sessions table - allow public access for session management
CREATE POLICY "Public can manage sessions" 
ON public.user_sessions 
FOR ALL 
USING (true);

-- Add function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < now();
END;
$$;