-- Add credits system to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits_balance DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_minutes_used DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create credits_transactions table for tracking all credit movements
CREATE TABLE IF NOT EXISTS public.credits_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('topup', 'deduction', 'refund', 'bonus')),
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  call_id TEXT,
  payment_id UUID REFERENCES public.payments(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_costs table for tracking actual costs per call
CREATE TABLE IF NOT EXISTS public.call_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id),

  -- Duration
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  duration_minutes DECIMAL(10, 4) NOT NULL DEFAULT 0.00,

  -- Individual component costs
  twilio_cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
  deepgram_cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
  llm_cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
  tts_cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00,

  -- Total costs
  total_provider_cost DECIMAL(10, 4) NOT NULL DEFAULT 0.00, -- What you pay
  charged_amount DECIMAL(10, 4) NOT NULL DEFAULT 0.00,      -- What client pays
  profit_margin DECIMAL(10, 4) NOT NULL DEFAULT 0.00,       -- Your profit

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'refunded')),
  charged_at TIMESTAMP WITH TIME ZONE,

  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX idx_credits_transactions_type ON public.credits_transactions(transaction_type);
CREATE INDEX idx_credits_transactions_created_at ON public.credits_transactions(created_at DESC);
CREATE INDEX idx_call_costs_user_id ON public.call_costs(user_id);
CREATE INDEX idx_call_costs_call_id ON public.call_costs(call_id);
CREATE INDEX idx_call_costs_campaign_id ON public.call_costs(campaign_id);
CREATE INDEX idx_call_costs_status ON public.call_costs(status);

-- Enable Row Level Security
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credits_transactions
CREATE POLICY "Users can view their own credit transactions"
ON public.credits_transactions
FOR SELECT
USING (auth.uid()::text = user_id::text);

-- RLS Policies for call_costs
CREATE POLICY "Users can view their own call costs"
ON public.call_costs
FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Function to add credits (topup)
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
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT credits_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- Update user balance
  UPDATE public.users
  SET credits_balance = v_new_balance,
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
    payment_id
  ) VALUES (
    p_user_id,
    'topup',
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    p_payment_id
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits (for calls)
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_call_id TEXT,
  p_description TEXT DEFAULT 'Call charge'
)
RETURNS UUID AS $$
DECLARE
  v_current_balance DECIMAL(10, 2);
  v_new_balance DECIMAL(10, 2);
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT credits_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;

  -- Update user balance
  UPDATE public.users
  SET credits_balance = v_new_balance,
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
    call_id
  ) VALUES (
    p_user_id,
    'deduction',
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    p_call_id
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(
  p_user_id UUID,
  p_required_amount DECIMAL(10, 2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10, 2);
BEGIN
  SELECT credits_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id;

  RETURN v_current_balance >= p_required_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create update_updated_at_column function (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on call_costs
CREATE TRIGGER update_call_costs_updated_at
  BEFORE UPDATE ON public.call_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT ON public.credits_transactions TO authenticated;
GRANT SELECT ON public.call_costs TO authenticated;
