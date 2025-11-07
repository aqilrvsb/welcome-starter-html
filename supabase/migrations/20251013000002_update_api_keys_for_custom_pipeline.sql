-- Update api_keys table to support custom STT-LLM-TTS pipeline
-- Replace VAPI with Deepgram, OpenRouter, and ElevenLabs

ALTER TABLE public.api_keys
-- Make vapi_api_key optional (for backward compatibility during migration)
ALTER COLUMN vapi_api_key DROP NOT NULL,
ALTER COLUMN assistant_id DROP NOT NULL,

-- Add new provider API keys
ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT,
ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT,

-- Add provider status tracking
ADD COLUMN IF NOT EXISTS deepgram_status TEXT DEFAULT 'not_configured' CHECK (deepgram_status IN ('not_configured', 'configured', 'verified', 'error')),
ADD COLUMN IF NOT EXISTS openrouter_status TEXT DEFAULT 'not_configured' CHECK (openrouter_status IN ('not_configured', 'configured', 'verified', 'error')),
ADD COLUMN IF NOT EXISTS elevenlabs_status TEXT DEFAULT 'not_configured' CHECK (elevenlabs_status IN ('not_configured', 'configured', 'verified', 'error')),

-- Add status field for overall API configuration
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_configured';

-- Add comment
COMMENT ON TABLE public.api_keys IS 'Stores user API keys for third-party services (Deepgram STT, OpenRouter LLM, ElevenLabs TTS)';
COMMENT ON COLUMN public.api_keys.deepgram_api_key IS 'Deepgram API key for Speech-to-Text';
COMMENT ON COLUMN public.api_keys.openrouter_api_key IS 'OpenRouter API key for LLM responses';
COMMENT ON COLUMN public.api_keys.elevenlabs_api_key IS 'ElevenLabs API key for Text-to-Speech';
COMMENT ON COLUMN public.api_keys.vapi_api_key IS 'DEPRECATED: Legacy VAPI API key (for backward compatibility)';
