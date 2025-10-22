-- Create table for phone configuration
CREATE TABLE public.phone_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  twilio_phone_number TEXT NOT NULL,
  twilio_account_sid TEXT NOT NULL,
  twilio_auth_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.phone_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own phone config" 
ON public.phone_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phone config" 
ON public.phone_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone config" 
ON public.phone_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone config" 
ON public.phone_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_phone_config_updated_at
BEFORE UPDATE ON public.phone_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();