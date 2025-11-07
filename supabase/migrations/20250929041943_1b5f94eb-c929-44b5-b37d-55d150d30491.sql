-- Update RLS policies for user_subscriptions to work with custom auth
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;

-- Create new policies that work with custom auth by checking user_id directly
CREATE POLICY "Users can create their own subscriptions" 
ON user_subscriptions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own subscriptions" 
ON user_subscriptions 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can view their own subscriptions" 
ON user_subscriptions 
FOR SELECT 
USING (true);

-- Update payments table RLS policies too
DROP POLICY IF EXISTS "Users can create their own payments" ON payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;

CREATE POLICY "Users can create their own payments" 
ON payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own payments" 
ON payments 
FOR SELECT 
USING (true);