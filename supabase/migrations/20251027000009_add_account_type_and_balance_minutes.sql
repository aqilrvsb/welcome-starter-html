-- Add account_type and balance minutes columns to users table

-- Add new columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'trial' CHECK (account_type IN ('trial', 'pro')),
ADD COLUMN IF NOT EXISTS trial_balance_minutes DECIMAL(10, 2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS pro_balance_minutes DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.users.account_type IS 'User account type: trial or pro';
COMMENT ON COLUMN public.users.trial_balance_minutes IS 'Remaining trial minutes balance';
COMMENT ON COLUMN public.users.pro_balance_minutes IS 'Remaining pro minutes balance (paid)';

-- Set default trial balance for existing users
UPDATE public.users
SET trial_balance_minutes = 10.00
WHERE trial_balance_minutes IS NULL;

UPDATE public.users
SET pro_balance_minutes = 0.00
WHERE pro_balance_minutes IS NULL;

UPDATE public.users
SET account_type = 'trial'
WHERE account_type IS NULL;
