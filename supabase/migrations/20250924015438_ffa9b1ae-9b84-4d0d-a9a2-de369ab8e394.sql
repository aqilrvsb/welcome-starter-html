-- Fix RLS policies for phone_config table to work with custom auth
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own phone config" ON public.phone_config;
DROP POLICY IF EXISTS "Users can update their own phone config" ON public.phone_config;
DROP POLICY IF EXISTS "Users can view their own phone config" ON public.phone_config;
DROP POLICY IF EXISTS "Users can delete their own phone config" ON public.phone_config;

-- Create new policies that allow all operations since we handle user validation in the app layer
-- This matches the pattern used by the api_keys table
CREATE POLICY "Allow all operations on phone_config" 
ON public.phone_config 
FOR ALL 
USING (true) 
WITH CHECK (true);