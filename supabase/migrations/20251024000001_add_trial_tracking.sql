-- Add trial tracking to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS trial_credits_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_claimed_at TIMESTAMP WITH TIME ZONE;

-- Function to claim trial credits (one-time only)
CREATE OR REPLACE FUNCTION public.claim_trial_credits(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_trial_claimed BOOLEAN;
  v_current_balance DECIMAL(10, 2);
  v_new_balance DECIMAL(10, 2);
  v_transaction_id UUID;
  v_trial_amount DECIMAL(10, 2) := 1.50; -- 10 minutes × RM0.15 = RM1.50
BEGIN
  -- Check if user has already claimed trial
  SELECT trial_credits_claimed, credits_balance
  INTO v_trial_claimed, v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  -- If already claimed, return error
  IF v_trial_claimed = TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trial credits already claimed',
      'message', 'You have already used your 10-minute free trial.'
    );
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + v_trial_amount;

  -- Update user with trial credits and mark as claimed
  UPDATE public.users
  SET
    credits_balance = v_new_balance,
    trial_credits_claimed = TRUE,
    trial_claimed_at = now(),
    updated_at = now()
  WHERE id = p_user_id;

  -- Create transaction record
  INSERT INTO public.credits_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description
  ) VALUES (
    p_user_id,
    'bonus',
    v_trial_amount,
    v_current_balance,
    v_new_balance,
    'Free trial credits - 10 minutes'
  )
  RETURNING id INTO v_transaction_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', v_trial_amount,
    'new_balance', v_new_balance,
    'message', 'Successfully claimed 10 minutes free trial (RM1.50)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.claim_trial_credits(UUID) TO authenticated;
