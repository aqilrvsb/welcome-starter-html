-- Add phone_number column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add WAHA configuration columns to phone_config table
ALTER TABLE public.phone_config
ADD COLUMN IF NOT EXISTS waha_base_url text DEFAULT 'https://waha-plus-production-705f.up.railway.app',
ADD COLUMN IF NOT EXISTS waha_api_key text,
ADD COLUMN IF NOT EXISTS waha_session_name text,
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'whacenter' CHECK (provider IN ('whacenter', 'waha', 'wablas')),
ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'scan_qr_code', 'starting', 'stopped'));

-- Add comment for clarity
COMMENT ON COLUMN public.users.phone_number IS 'User phone number for WhatsApp connection';
COMMENT ON COLUMN public.phone_config.provider IS 'WhatsApp provider: whacenter, waha, or wablas';
COMMENT ON COLUMN public.phone_config.waha_session_name IS 'WAHA session name format: user_{user_id}';
COMMENT ON COLUMN public.phone_config.connection_status IS 'Current WhatsApp connection status';