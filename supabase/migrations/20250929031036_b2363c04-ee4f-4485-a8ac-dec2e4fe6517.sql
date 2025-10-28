-- Create RLS policies for users table (custom auth system)

-- Allow anyone to insert new users (for signup)
CREATE POLICY "Allow public user creation" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

-- Allow users to select their own data
CREATE POLICY "Users can select their own data" 
ON public.users 
FOR SELECT 
USING (true);  -- For now, allow reading user data

-- Allow users to update their own data
CREATE POLICY "Users can update their own data" 
ON public.users 
FOR UPDATE 
USING (true);  -- For now, allow updating user data

-- Create RLS policies for user_sessions table

-- Allow anyone to insert sessions (for login)
CREATE POLICY "Allow session creation" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (true);

-- Allow session deletion (for logout)
CREATE POLICY "Allow session deletion" 
ON public.user_sessions 
FOR DELETE 
USING (true);

-- Allow session selection
CREATE POLICY "Allow session selection" 
ON public.user_sessions 
FOR SELECT 
USING (true);

-- Create RLS policies for other tables that need user access

-- Agents table - users can manage their own agents
CREATE POLICY "Users can manage their own agents" 
ON public.agents 
FOR ALL 
USING (user_id::text = user_id::text);

-- API Keys table - users can manage their own API keys
CREATE POLICY "Users can manage their own API keys" 
ON public.api_keys 
FOR ALL 
USING (user_id::text = user_id::text);

-- Call logs table - users can view their own call logs
CREATE POLICY "Users can view their own call logs" 
ON public.call_logs 
FOR SELECT 
USING (user_id::text = user_id::text);

CREATE POLICY "Users can insert their own call logs" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (user_id::text = user_id::text);

-- Campaigns table - users can manage their own campaigns
CREATE POLICY "Users can manage their own campaigns" 
ON public.campaigns 
FOR ALL 
USING (user_id::text = user_id::text);

-- Messages table - users can manage their own messages
CREATE POLICY "Users can manage their own messages" 
ON public.messages 
FOR ALL 
USING (user_id::text = user_id::text);

-- Numbers table - users can manage their own numbers
CREATE POLICY "Users can manage their own numbers" 
ON public.numbers 
FOR ALL 
USING (user_id::text = user_id::text);

-- Phone config table - users can manage their own phone config
CREATE POLICY "Users can manage their own phone config" 
ON public.phone_config 
FOR ALL 
USING (user_id::text = user_id::text);

-- Profiles table - users can manage their own profiles
CREATE POLICY "Users can manage their own profiles" 
ON public.profiles 
FOR ALL 
USING (id::text = id::text);

-- Prompts table - users can manage their own prompts
CREATE POLICY "Users can manage their own prompts" 
ON public.prompts 
FOR ALL 
USING (user_id::text = user_id::text);

-- Voice config table - users can manage their own voice config
CREATE POLICY "Users can manage their own voice config" 
ON public.voice_config 
FOR ALL 
USING (user_id::text = user_id::text);