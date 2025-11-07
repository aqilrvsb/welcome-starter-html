-- Enable required extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a scheduled job to expire trials every hour
-- This checks for any trial subscriptions that have passed their trial_end_date
SELECT cron.schedule(
  'expire-trials-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/expire-trials',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDMwMjIsImV4cCI6MjA3NTgxOTAyMn0.VH_VZsEngYCHZDESJXnQpkGWWQpxSGs0JsdrDfwfLYw"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
