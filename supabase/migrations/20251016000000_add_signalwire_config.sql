-- Migration: Add SignalWire configuration fields
-- Date: 2025-10-16
-- Purpose: Replace Twilio with SignalWire for cheaper calls

-- Add SignalWire fields to phone_config table
ALTER TABLE phone_config
ADD COLUMN IF NOT EXISTS signalwire_project_id TEXT,
ADD COLUMN IF NOT EXISTS signalwire_auth_token TEXT,
ADD COLUMN IF NOT EXISTS signalwire_space_url TEXT,
ADD COLUMN IF NOT EXISTS signalwire_phone_number TEXT,
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'twilio';

-- Add comment
COMMENT ON COLUMN phone_config.provider_type IS 'Phone provider: twilio or signalwire';
COMMENT ON COLUMN phone_config.signalwire_project_id IS 'SignalWire Project ID from API Credentials';
COMMENT ON COLUMN phone_config.signalwire_auth_token IS 'SignalWire Auth Token (keep secret)';
COMMENT ON COLUMN phone_config.signalwire_space_url IS 'SignalWire Space URL (e.g., yourspace.signalwire.com)';
COMMENT ON COLUMN phone_config.signalwire_phone_number IS 'SignalWire phone number in E.164 format';

-- Update existing records to use twilio by default
UPDATE phone_config
SET provider_type = 'twilio'
WHERE provider_type IS NULL;
