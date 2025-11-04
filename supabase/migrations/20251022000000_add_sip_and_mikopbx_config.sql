-- Migration: Add AlienVOIP SIP trunk and MikoPBX configuration to phone_config
-- This replaces Twilio with AlienVOIP SIP provider

-- Step 1: Add new columns as NULLABLE first (to allow existing rows)
ALTER TABLE phone_config
ADD COLUMN IF NOT EXISTS mikopbx_url TEXT,
ADD COLUMN IF NOT EXISTS mikopbx_api_key TEXT,
ADD COLUMN IF NOT EXISTS mikopbx_ami_username TEXT,
ADD COLUMN IF NOT EXISTS mikopbx_ami_password TEXT,
ADD COLUMN IF NOT EXISTS sip_proxy_primary TEXT,
ADD COLUMN IF NOT EXISTS sip_proxy_secondary TEXT,
ADD COLUMN IF NOT EXISTS sip_username TEXT,
ADD COLUMN IF NOT EXISTS sip_password TEXT,
ADD COLUMN IF NOT EXISTS sip_display_name TEXT,
ADD COLUMN IF NOT EXISTS sip_caller_id TEXT,
ADD COLUMN IF NOT EXISTS sip_codec TEXT;

-- Step 2: Set default values for existing rows
UPDATE phone_config
SET
  mikopbx_url = COALESCE(mikopbx_url, 'http://68.183.177.218'),
  mikopbx_ami_username = COALESCE(mikopbx_ami_username, 'admin'),
  sip_proxy_primary = COALESCE(sip_proxy_primary, 'CONFIGURE_ME'),
  sip_proxy_secondary = COALESCE(sip_proxy_secondary, 'CONFIGURE_ME'),
  sip_username = COALESCE(sip_username, 'CONFIGURE_ME'),
  sip_password = COALESCE(sip_password, 'CONFIGURE_ME'),
  sip_codec = COALESCE(sip_codec, 'ulaw')
WHERE mikopbx_url IS NULL
   OR sip_proxy_primary IS NULL
   OR sip_username IS NULL
   OR sip_password IS NULL;

-- Step 3: Now make required fields NOT NULL with defaults
ALTER TABLE phone_config
ALTER COLUMN mikopbx_url SET DEFAULT 'http://68.183.177.218',
ALTER COLUMN mikopbx_url SET NOT NULL,
ALTER COLUMN mikopbx_ami_username SET DEFAULT 'admin',
ALTER COLUMN sip_proxy_primary SET NOT NULL,
ALTER COLUMN sip_username SET NOT NULL,
ALTER COLUMN sip_password SET NOT NULL,
ALTER COLUMN sip_codec SET DEFAULT 'ulaw';

-- Step 4: Add comments for documentation
COMMENT ON COLUMN phone_config.mikopbx_url IS 'MikoPBX server URL (http://68.183.177.218)';
COMMENT ON COLUMN phone_config.mikopbx_api_key IS 'MikoPBX API key for REST API calls';
COMMENT ON COLUMN phone_config.mikopbx_ami_username IS 'Asterisk Manager Interface username';
COMMENT ON COLUMN phone_config.mikopbx_ami_password IS 'Asterisk Manager Interface password';
COMMENT ON COLUMN phone_config.sip_proxy_primary IS 'Primary SIP proxy server (e.g., sip1.alienvoip.com)';
COMMENT ON COLUMN phone_config.sip_proxy_secondary IS 'Secondary/backup SIP proxy server (e.g., sip3.alienvoip.com)';
COMMENT ON COLUMN phone_config.sip_username IS 'AlienVOIP SIP account username';
COMMENT ON COLUMN phone_config.sip_password IS 'AlienVOIP SIP account password';
COMMENT ON COLUMN phone_config.sip_display_name IS 'Display name for outgoing calls';
COMMENT ON COLUMN phone_config.sip_caller_id IS 'Caller ID number for outgoing calls';
COMMENT ON COLUMN phone_config.sip_codec IS 'Preferred codec: ulaw, alaw, gsm, g729, g723';

-- Step 5: Drop old Twilio/SignalWire fields (we're removing them completely)
ALTER TABLE phone_config
DROP COLUMN IF EXISTS twilio_phone_number,
DROP COLUMN IF EXISTS twilio_account_sid,
DROP COLUMN IF EXISTS twilio_auth_token,
DROP COLUMN IF EXISTS signalwire_project_id,
DROP COLUMN IF EXISTS signalwire_space_url,
DROP COLUMN IF EXISTS signalwire_phone_number,
DROP COLUMN IF EXISTS signalwire_auth_token,
DROP COLUMN IF EXISTS provider_type;
