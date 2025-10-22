-- Add erp_webhook_url column to phone_config table
ALTER TABLE phone_config 
ADD COLUMN IF NOT EXISTS erp_webhook_url TEXT;