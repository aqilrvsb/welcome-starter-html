-- Add column to store captured data from AI calls
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS captured_data jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN call_logs.captured_data IS 'Stores the variable data captured during the AI call based on the prompt variables';