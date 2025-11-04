-- Add retry configuration columns to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS retry_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retry_interval_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_retry_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS current_retry_count INTEGER DEFAULT 0;

-- Add retry tracking to call_logs table
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_retry BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_campaign_id UUID REFERENCES public.campaigns(id);

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_campaigns_retry_pending 
ON public.campaigns(user_id, retry_enabled, status, current_retry_count, max_retry_attempts)
WHERE retry_enabled = true AND status = 'completed';