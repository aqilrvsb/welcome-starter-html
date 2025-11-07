-- Update recording URLs to point to new FreeSWITCH server
-- Changes 159.223.45.224 to 178.128.57.106 in recording_url

UPDATE public.call_logs
SET recording_url = REPLACE(recording_url, '159.223.45.224', '178.128.57.106')
WHERE recording_url LIKE '%159.223.45.224%';

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % recording URLs from old server to new server', updated_count;
END $$;
