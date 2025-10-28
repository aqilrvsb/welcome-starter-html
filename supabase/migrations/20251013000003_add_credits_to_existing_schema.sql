-- Add Credits System to Existing Schema
-- This migration adds new columns and tables WITHOUT dropping existing data

-- ============================================
-- 1. Add new columns to existing users table
-- ============================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits_balance DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_minutes_used DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.users.credits_balance IS 'Current credits balance in MYR';
COMMENT ON COLUMN public.users.total_minutes_used IS 'Total call minutes used';

-- ============================================
-- 2. Add new columns to existing api_keys table
-- ============================================

ALTER TABLE public.api_keys
-- Make vapi_api_key optional (for backward compatibility)
ALTER COLUMN vapi_api_key DROP NOT NULL,
ALTER COLUMN assistant_id DROP NOT NULL,

-- Add new provider API keys (optional - YOU own these as environment variables)
ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT,
ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT,

-- Add provider status tracking
ADD COLUMN IF NOT EXISTS deepgram_status TEXT DEFAULT 'not_configured' CHECK (deepgram_status IN ('not_configured', 'configured', 'verified', 'error')),
ADD COLUMN IF NOT EXISTS openrouter_status TEXT DEFAULT 'not_configured' CHECK (openrouter_status IN ('not_configured', 'configured', 'verified', 'error')),
ADD COLUMN IF NOT EXISTS elevenlabs_status TEXT DEFAULT 'not_configured' CHECK (elevenlabs_status IN ('not_configured', 'configured', 'verified', 'error'));

COMMENT ON TABLE public.api_keys IS 'Stores user API keys for third-party services';
COMMENT ON COLUMN public.api_keys.deepgram_api_key IS 'OPTIONAL: Deepgram API key (if client wants their own)';
COMMENT ON COLUMN public.api_keys.openrouter_api_key IS 'OPTIONAL: OpenRouter API key (if client wants their own)';
COMMENT ON COLUMN public.api_keys.elevenlabs_api_key IS 'OPTIONAL: ElevenLabs API key (if client wants their own)';
COMMENT ON COLUMN public.api_keys.vapi_api_key IS 'DEPRECATED: Legacy VAPI API key';

-- ============================================
-- 3. Create credits_transactions table
-- ============================================

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

-- Indexes for credits_transactions
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_type ON public.credits_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON public.credits_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own credit transactions"
ON public.credits_transactions
FOR SELECT
USING (true);

-- ============================================
-- 4. Create call_costs table
-- ============================================

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

-- Indexes for call_costs
CREATE INDEX IF NOT EXISTS idx_call_costs_user_id ON public.call_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_costs_call_id ON public.call_costs(call_id);
CREATE INDEX IF NOT EXISTS idx_call_costs_campaign_id ON public.call_costs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_costs_status ON public.call_costs(status);

-- Enable RLS
ALTER TABLE public.call_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own call costs"
ON public.call_costs
FOR SELECT
USING (true);

-- ============================================
-- 5. Create helper functions
-- ============================================

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

  -- Update user balance and total minutes
  UPDATE public.users
  SET credits_balance = v_new_balance,
      total_minutes_used = total_minutes_used + (p_amount / 0.20), -- Assuming $0.20/min
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

-- ============================================
-- 6. Create trigger for updated_at on call_costs
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_call_costs_updated_at
  BEFORE UPDATE ON public.call_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. Grant permissions
-- ============================================

GRANT SELECT ON public.credits_transactions TO authenticated;
GRANT SELECT ON public.call_costs TO authenticated;

-- ============================================
-- 8. Insert default data (if needed)
-- ============================================

-- Ensure all existing users have credits_balance set
UPDATE public.users
SET credits_balance = 0.00
WHERE credits_balance IS NULL;

UPDATE public.users
SET total_minutes_used = 0.00
WHERE total_minutes_used IS NULL;

-- ============================================
-- Done!
-- ============================================

COMMENT ON TABLE public.credits_transactions IS 'Tracks all credit movements (topup, deduction, refund, bonus)';
COMMENT ON TABLE public.call_costs IS 'Tracks per-call costs and profit margins';
