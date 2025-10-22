-- Add status column to existing api_keys table
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_connected';

-- Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  voice TEXT,
  language TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agents
CREATE POLICY "Users can view their own agents" 
ON public.agents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agents" 
ON public.agents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" 
ON public.agents 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" 
ON public.agents 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create numbers table
CREATE TABLE IF NOT EXISTS public.numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on numbers table
ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for numbers
CREATE POLICY "Users can view their own numbers" 
ON public.numbers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own numbers" 
ON public.numbers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own numbers" 
ON public.numbers 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own numbers" 
ON public.numbers 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  call_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on call_logs table
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for call_logs
CREATE POLICY "Users can view their own call logs" 
ON public.call_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own call logs" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call logs" 
ON public.call_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call logs" 
ON public.call_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_numbers_updated_at
BEFORE UPDATE ON public.numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();