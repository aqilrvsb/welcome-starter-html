-- Create whatsapp_templates table for storing custom message templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL,
  message_text TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_message_type UNIQUE (user_id, message_type)
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for whatsapp_templates
CREATE POLICY "Users can manage their own templates"
ON public.whatsapp_templates
FOR ALL
USING (auth.uid()::text = user_id::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();