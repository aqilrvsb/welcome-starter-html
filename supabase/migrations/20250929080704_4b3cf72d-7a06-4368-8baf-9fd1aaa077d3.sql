-- Create missing RPC functions for campaign statistics
CREATE OR REPLACE FUNCTION increment_campaign_success(campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaigns 
  SET successful_calls = COALESCE(successful_calls, 0) + 1,
      updated_at = now()
  WHERE id = campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaigns 
  SET failed_calls = COALESCE(failed_calls, 0) + 1,
      updated_at = now()
  WHERE id = campaign_id;
END;
$$;