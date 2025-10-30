-- Migration: Add Trial System
-- Description: Add trial minutes tracking and account type selection

-- 1. Add new columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS trial_minutes_total NUMERIC DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'trial' CHECK (account_type IN ('trial', 'pro'));

-- 2. Update existing users to have trial minutes
UPDATE public.users
SET trial_minutes_total = 10.0,
    account_type = 'trial'
WHERE trial_minutes_total IS NULL;

-- 3. Create function to auto-claim trial on user registration
CREATE OR REPLACE FUNCTION public.auto_claim_trial_on_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set trial minutes and account type for new users
  NEW.trial_minutes_total := 10.0;
  NEW.trial_minutes_used := 0.0;
  NEW.trial_credits_claimed := true;
  NEW.trial_claimed_at := NOW();
  NEW.account_type := 'trial';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for auto-claim
DROP TRIGGER IF EXISTS trigger_auto_claim_trial ON public.users;
CREATE TRIGGER trigger_auto_claim_trial
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_claim_trial_on_registration();

-- 5. Create function to check trial balance
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
  v_used NUMERIC;
BEGIN
  SELECT
    COALESCE(trial_minutes_total, 0),
    COALESCE(trial_minutes_used, 0)
  INTO v_total, v_used
  FROM public.users
  WHERE id = p_user_id;

  RETURN GREATEST(v_total - v_used, 0);
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to check if user can make call
CREATE OR REPLACE FUNCTION public.can_user_make_call(
  p_user_id UUID,
  p_account_type TEXT,
  p_estimated_minutes NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_balance NUMERIC;
  v_credits_balance NUMERIC;
BEGIN
  -- Get user balances
  SELECT
    COALESCE(trial_minutes_total - trial_minutes_used, 0),
    COALESCE(credits_balance, 0)
  INTO v_trial_balance, v_credits_balance
  FROM public.users
  WHERE id = p_user_id;

  -- Check based on account type
  IF p_account_type = 'trial' THEN
    RETURN v_trial_balance >= p_estimated_minutes;
  ELSIF p_account_type = 'pro' THEN
    -- Pro account: RM 0.15 per minute
    RETURN v_credits_balance >= (p_estimated_minutes * 0.15);
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users(account_type);
CREATE INDEX IF NOT EXISTS idx_users_trial_balance ON public.users(trial_minutes_total, trial_minutes_used);

-- 8. Add comment for documentation
COMMENT ON COLUMN public.users.trial_minutes_total IS 'Total trial minutes allocated (default 10.0)';
COMMENT ON COLUMN public.users.trial_minutes_used IS 'Trial minutes consumed by user';
COMMENT ON COLUMN public.users.account_type IS 'Account type: trial (free 10 min) or pro (paid credits)';
COMMENT ON FUNCTION public.get_trial_balance IS 'Returns remaining trial minutes for user';
COMMENT ON FUNCTION public.can_user_make_call IS 'Check if user has sufficient balance to make call';
