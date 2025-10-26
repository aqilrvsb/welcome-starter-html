-- Remove Deepgram STT Provider setting from system_settings table
-- Run this SQL in your Supabase SQL editor
-- NOTE: We're keeping openrouter_model setting as it's still used

-- Remove STT Provider setting (Deepgram/Azure selector - no longer used)
DELETE FROM public.system_settings
WHERE setting_key = 'stt_provider';

-- Verify removal (should return 0 rows)
SELECT * FROM public.system_settings
WHERE setting_key = 'stt_provider';
