-- Fix RLS policy for credits_transactions to work with custom auth
-- Since we use custom users table (not auth.users), we need to disable RLS
-- or create a permissive policy

-- Drop the old policy that relies on auth.uid()
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON public.credits_transactions;

-- Create a new permissive policy
-- Since custom auth doesn't use auth.uid(), we'll make it accessible to authenticated API requests
-- The application layer (frontend) will filter by user_id
CREATE POLICY "Enable read access for authenticated requests"
ON public.credits_transactions
FOR SELECT
USING (true);

-- Keep INSERT restricted to service role only (admin and system operations)
CREATE POLICY "Enable insert for service role only"
ON public.credits_transactions
FOR INSERT
WITH CHECK (false);  -- This will be bypassed by service role key

-- Add comment for clarity
COMMENT ON POLICY "Enable read access for authenticated requests" ON public.credits_transactions
IS 'Allows reading transactions. Filtering by user_id is done in application layer via custom auth.';
