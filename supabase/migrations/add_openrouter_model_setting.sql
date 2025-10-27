-- Add OpenRouter Model setting to system_settings table
-- Run this SQL in your Supabase SQL editor

-- Insert OpenRouter Model setting (default: openai/gpt-4o-mini)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES (
  'openrouter_model',
  'openai/gpt-4o-mini',
  'string',
  'OpenRouter AI model to use for responses (e.g., openai/gpt-4o-mini, anthropic/claude-3-haiku)',
  false
)
ON CONFLICT (setting_key) DO NOTHING;

-- Verify insertion
SELECT * FROM public.system_settings
WHERE setting_key = 'openrouter_model';
