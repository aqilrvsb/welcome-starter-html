-- Add details column to call_logs table to store extracted %% wrapped content
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS details TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.call_logs.details IS 'Stores extracted details from AI conversation wrapped in %% markers';
