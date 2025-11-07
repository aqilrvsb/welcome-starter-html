-- Fix RLS policies for prompts table to work with custom auth
-- Drop existing policies that rely on auth.uid()
DROP POLICY IF EXISTS "Users can view their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can create their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can update their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.prompts;

-- Create new policies that allow all operations since we handle user validation in the app layer
-- This matches the pattern used by the api_keys and phone_config tables
CREATE POLICY "Allow all operations on prompts" 
ON public.prompts 
FOR ALL 
USING (true) 
WITH CHECK (true);