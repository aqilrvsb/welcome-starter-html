-- Rename mikopbx_url to freeswitch_url
-- FreeSWITCH is better for AI call handling!

ALTER TABLE phone_config
RENAME COLUMN mikopbx_url TO freeswitch_url;

-- Update any existing default values
UPDATE phone_config
SET freeswitch_url = 'http://159.223.45.224'
WHERE freeswitch_url = 'http://68.183.177.218' OR freeswitch_url = 'CONFIGURE_ME';

-- Add comment
COMMENT ON COLUMN phone_config.freeswitch_url IS 'FreeSWITCH server URL for ESL connection';
