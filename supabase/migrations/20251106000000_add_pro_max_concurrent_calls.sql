-- Add pro_max_concurrent_calls setting to system_settings
-- This controls the maximum number of concurrent calls for Pro users

INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'pro_max_concurrent_calls',
  '10',
  'number',
  'Maximum number of simultaneous calls per Pro user. This limit is strictly enforced for batch calls and campaigns.'
)
ON CONFLICT (setting_key) DO NOTHING;
