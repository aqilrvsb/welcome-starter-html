-- Add unique constraint on user_id for voice_config table
ALTER TABLE public.voice_config ADD CONSTRAINT voice_config_user_id_unique UNIQUE (user_id);

-- Update RLS policies for voice_config to work with custom authentication (disable RLS temporarily)
ALTER TABLE public.voice_config DISABLE ROW LEVEL SECURITY;

-- Create new RLS policies that allow all operations for now (since custom auth is used)
CREATE POLICY "Allow all operations on voice_config" 
ON public.voice_config 
FOR ALL 
USING (true) 
WITH CHECK (true);