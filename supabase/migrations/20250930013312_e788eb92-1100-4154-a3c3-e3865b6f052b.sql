-- Add WhatsApp Center Device ID to phone_config table
ALTER TABLE phone_config 
ADD COLUMN whacenter_device_id text;