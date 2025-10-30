-- Add voice_provider column to agents table
ALTER TABLE public.agents 
ADD COLUMN voice_provider text DEFAULT 'elevenlabs';