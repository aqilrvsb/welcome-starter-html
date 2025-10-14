-- Update Pro Plan price to RM 1
UPDATE subscription_plans
SET 
  price = 1.00,
  updated_at = now()
WHERE name = 'Pro Plan';