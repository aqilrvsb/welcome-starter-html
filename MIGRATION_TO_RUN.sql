-- ========================================
-- MIGRATION: Add prompt_id to call_logs
-- Run this in Supabase SQL Editor
-- ========================================

-- Add prompt_id column to call_logs table
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS prompt_id UUID;

-- Add foreign key constraint to prompts table
ALTER TABLE public.call_logs
ADD CONSTRAINT call_logs_prompt_id_fkey
FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_logs_prompt_id ON public.call_logs(prompt_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.call_logs.prompt_id IS 'Direct reference to the prompt used for this call. This is required since campaign_id is now optional.';

-- ========================================
-- VERIFY: Check if column was added
-- ========================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'call_logs'
  AND column_name = 'prompt_id';
