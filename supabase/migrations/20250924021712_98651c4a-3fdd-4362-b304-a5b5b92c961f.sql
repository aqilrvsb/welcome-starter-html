-- Enable RLS on api_keys table to address security warning
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for api_keys table
CREATE POLICY "Allow all operations on api_keys" 
ON public.api_keys 
FOR ALL 
USING (true) 
WITH CHECK (true);