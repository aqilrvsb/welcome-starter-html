-- Drop the cron job for expiring trials
SELECT cron.unschedule('expire-trials-hourly');