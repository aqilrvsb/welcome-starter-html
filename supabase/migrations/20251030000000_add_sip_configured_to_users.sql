-- Add sip_configured column to users table
-- This allows admins to mark users as SIP configured
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sip_configured boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.users.sip_configured IS 'Flag to indicate if admin has configured SIP settings for this user';
