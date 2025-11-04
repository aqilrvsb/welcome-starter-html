-- Add stage_reached column to call_logs to track conversation progress
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS stage_reached text;

COMMENT ON COLUMN public.call_logs.stage_reached IS 'The stage in the conversation flow where the call ended (based on prompt stages)';