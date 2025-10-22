-- First, keep only the most recent subscription for each user
WITH ranked_subs AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM user_subscriptions
)
DELETE FROM user_subscriptions
WHERE id IN (
  SELECT id FROM ranked_subs WHERE rn > 1
);

-- Add unique constraint on user_id to prevent duplicates
ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);

-- Update the create_trial_subscription function to use INSERT with conflict handling
CREATE OR REPLACE FUNCTION public.create_trial_subscription(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if subscription already exists
  SELECT id INTO v_subscription_id
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;
  
  -- If exists, return existing subscription id
  IF v_subscription_id IS NOT NULL THEN
    RETURN v_subscription_id;
  END IF;
  
  -- Calculate trial end date
  v_trial_end := now() + interval '7 days';
  
  -- Insert new trial subscription with conflict handling
  INSERT INTO public.user_subscriptions (
    user_id, 
    status, 
    trial_start_date, 
    trial_end_date,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    'trial',
    now(),
    v_trial_end,
    now(),
    v_trial_end
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_subscription_id;
  
  -- If insert failed due to conflict, get existing id
  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id
    FROM public.user_subscriptions
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN v_subscription_id;
END;
$$;