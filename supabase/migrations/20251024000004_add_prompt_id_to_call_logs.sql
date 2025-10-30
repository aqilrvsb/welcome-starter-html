-- Add prompt_id column to call_logs table
-- This allows call_logs to directly reference prompts, even when campaign is optional/null

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
