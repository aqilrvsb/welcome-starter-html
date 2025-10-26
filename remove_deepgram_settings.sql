-- Remove Deepgram-related settings from system_settings table
-- Run this SQL in your Supabase SQL editor

-- Remove STT Provider setting
DELETE FROM public.system_settings
WHERE setting_key = 'stt_provider';

-- Remove OpenRouter Model setting
DELETE FROM public.system_settings
WHERE setting_key = 'openrouter_model';

-- Verify removal (should return 0 rows)
SELECT * FROM public.system_settings
WHERE setting_key IN ('stt_provider', 'openrouter_model');
