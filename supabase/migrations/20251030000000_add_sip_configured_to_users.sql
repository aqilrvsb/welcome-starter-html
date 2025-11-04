-- Add sip_configured column to users table
-- This allows admins to mark users as SIP configured
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sip_configured boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.users.sip_configured IS 'Flag to indicate if admin has configured SIP settings for this user';

-- Auto-set sip_configured to true for users who already have SIP credentials
UPDATE public.users
SET sip_configured = true
WHERE id IN (
  SELECT user_id
  FROM public.phone_config
  WHERE sip_username IS NOT NULL
    AND sip_username != ''
    AND sip_password IS NOT NULL
    AND sip_password != ''
);
