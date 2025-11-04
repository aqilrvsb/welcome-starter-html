-- Fix add_credits function to also add minutes to pro_balance_minutes
-- This ensures that when users top up credits, they see their balance in BOTH MYR and minutes

-- Drop existing function
DROP FUNCTION IF EXISTS public.add_credits(UUID, DECIMAL, UUID, TEXT);

-- Recreate with minutes calculation
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_payment_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Credit top-up'
)
RETURNS UUID AS $$
DECLARE
  v_current_balance DECIMAL(10, 2);
  v_new_balance DECIMAL(10, 2);
  v_current_minutes DECIMAL(10, 2);
  v_added_minutes DECIMAL(10, 2);
  v_new_minutes DECIMAL(10, 2);
  v_pricing_per_minute DECIMAL(10, 2);
  v_transaction_id UUID;
BEGIN
  -- Get pricing per minute from settings (default RM 0.15)
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM public.app_settings WHERE setting_key = 'pricing_per_minute'),
    0.15
  ) INTO v_pricing_per_minute;

  -- Get current balance and minutes
  SELECT credits_balance, pro_balance_minutes
  INTO v_current_balance, v_current_minutes
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- Calculate minutes to add (amount / price per minute)
  v_added_minutes := p_amount / v_pricing_per_minute;
  v_new_minutes := v_current_minutes + v_added_minutes;

  -- Update user balance AND minutes
  UPDATE public.users
  SET
    credits_balance = v_new_balance,
    pro_balance_minutes = v_new_minutes,
    account_type = 'pro', -- Auto-upgrade to pro when topping up
    updated_at = now()
  WHERE id = p_user_id;

  -- Create transaction record
  INSERT INTO public.credits_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    payment_id,
    metadata
  ) VALUES (
    p_user_id,
    'topup',
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    p_payment_id,
    jsonb_build_object(
      'minutes_added', v_added_minutes,
      'minutes_before', v_current_minutes,
      'minutes_after', v_new_minutes,
      'rate_per_minute', v_pricing_per_minute
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.add_credits IS 'Adds credits to user balance and converts to minutes. Auto-upgrades user to pro account.';
