-- Fix RLS policies for all remaining tables to work with custom auth
-- Fix agents table
DROP POLICY IF EXISTS "Users can view their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can create their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can update their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete their own agents" ON public.agents;

CREATE POLICY "Allow all operations on agents" 
ON public.agents 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Fix call_logs table  
DROP POLICY IF EXISTS "Users can view their own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can create their own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can update their own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can delete their own call logs" ON public.call_logs;

CREATE POLICY "Allow all operations on call_logs" 
ON public.call_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Fix campaigns table
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

CREATE POLICY "Allow all operations on campaigns" 
ON public.campaigns 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Fix messages table
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can create their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Allow all operations on messages" 
ON public.messages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Fix numbers table
DROP POLICY IF EXISTS "Users can view their own numbers" ON public.numbers;
DROP POLICY IF EXISTS "Users can create their own numbers" ON public.numbers;
DROP POLICY IF EXISTS "Users can update their own numbers" ON public.numbers;
DROP POLICY IF EXISTS "Users can delete their own numbers" ON public.numbers;

CREATE POLICY "Allow all operations on numbers" 
ON public.numbers 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Fix profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Allow all operations on profiles" 
ON public.profiles 
FOR ALL 
USING (true) 
WITH CHECK (true);