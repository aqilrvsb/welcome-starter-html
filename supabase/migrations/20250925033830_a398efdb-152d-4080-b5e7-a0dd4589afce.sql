-- Create voice_config table for centralized voice settings
CREATE TABLE public.voice_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  country_code TEXT DEFAULT '+60',
  default_name TEXT DEFAULT 'AI Assistant',
  concurrent_limit INTEGER DEFAULT 3 CHECK (concurrent_limit >= 1 AND concurrent_limit <= 10),
  manual_voice_id TEXT,
  provider TEXT DEFAULT '11labs',
  model TEXT DEFAULT 'eleven_flash_v2_5',
  stability DECIMAL DEFAULT 0.8 CHECK (stability >= 0 AND stability <= 1),
  similarity_boost DECIMAL DEFAULT 1 CHECK (similarity_boost >= 0 AND similarity_boost <= 1),
  style DECIMAL DEFAULT 0.0 CHECK (style >= 0 AND style <= 1),
  use_speaker_boost BOOLEAN DEFAULT false,
  speed DECIMAL DEFAULT 0.8 CHECK (speed >= 0.25 AND speed <= 4),
  optimize_streaming_latency INTEGER DEFAULT 4 CHECK (optimize_streaming_latency >= 0 AND optimize_streaming_latency <= 4),
  auto_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own voice config" 
ON public.voice_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice config" 
ON public.voice_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice config" 
ON public.voice_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice config" 
ON public.voice_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_voice_config_updated_at
BEFORE UPDATE ON public.voice_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();