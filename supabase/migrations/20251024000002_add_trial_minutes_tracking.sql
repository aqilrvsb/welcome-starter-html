-- Add trial minutes tracking to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS trial_minutes_used DECIMAL(10, 2) DEFAULT 0.00;

-- Add comment for clarity
COMMENT ON COLUMN public.users.trial_minutes_used IS 'Tracks how many minutes of the 10-minute free trial have been used';
