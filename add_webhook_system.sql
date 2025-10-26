-- ============================================================================
-- WEBHOOK SYSTEM - Name-Based Routing for Easy Client Integration
-- ============================================================================

-- 1. Add unique constraint to prompts (prompt_name must be unique per user)
ALTER TABLE public.prompts
ADD CONSTRAINT prompts_user_id_prompt_name_unique UNIQUE (user_id, prompt_name);

-- 2. Add unique constraint to campaigns (campaign_name must be unique per user)
ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_user_id_campaign_name_unique UNIQUE (user_id, campaign_name);

-- 3. Create webhooks table
CREATE TABLE public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  webhook_name text NOT NULL, -- e.g., "Website Form", "CRM Integration"
  webhook_type text NOT NULL CHECK (webhook_type = ANY (ARRAY['lead_only'::text, 'lead_and_call'::text])),
  webhook_token text NOT NULL UNIQUE, -- Unique token for URL (e.g., 'x7k9m2p4q8r5')
  webhook_url text NOT NULL UNIQUE,   -- Full webhook URL

  -- Defaults (using NAMES, not UUIDs for easy client integration!)
  default_prompt_name text,   -- e.g., "Sales Script v2" (required for lead_and_call)
  default_campaign_name text, -- e.g., "March Promotion" (optional)

  -- Stats
  is_active boolean DEFAULT true,
  total_requests integer DEFAULT 0,
  successful_requests integer DEFAULT 0,
  failed_requests integer DEFAULT 0,
  last_request_at timestamp with time zone,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT webhooks_pkey PRIMARY KEY (id),
  CONSTRAINT webhooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT webhooks_user_id_webhook_name_unique UNIQUE (user_id, webhook_name)
);

-- 4. Create webhook logs table (for debugging and monitoring)
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  response_status text NOT NULL CHECK (response_status = ANY (ARRAY['success'::text, 'error'::text])),
  contact_id uuid,
  call_id uuid,
  error_message text,
  processing_time_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE,
  CONSTRAINT webhook_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL,
  CONSTRAINT webhook_logs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.call_logs(id) ON DELETE SET NULL
);

-- 5. Create indexes for performance
CREATE INDEX idx_webhooks_user_id ON public.webhooks(user_id);
CREATE INDEX idx_webhooks_token ON public.webhooks(webhook_token);
CREATE INDEX idx_webhooks_active ON public.webhooks(is_active);
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for webhooks
CREATE POLICY "Users can view their own webhooks"
  ON public.webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks"
  ON public.webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks"
  ON public.webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks"
  ON public.webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- 8. RLS Policies for webhook_logs
CREATE POLICY "Users can view their own webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhooks
      WHERE webhooks.id = webhook_logs.webhook_id
      AND webhooks.user_id = auth.uid()
    )
  );

-- 9. Function to generate unique webhook token
CREATE OR REPLACE FUNCTION generate_webhook_token()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 10. Function to auto-generate webhook URL on insert
CREATE OR REPLACE FUNCTION set_webhook_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate token if not provided
  IF NEW.webhook_token IS NULL THEN
    NEW.webhook_token := generate_webhook_token();
  END IF;

  -- Generate URL based on type (Deno Deploy project: sifucallwebhook)
  IF NEW.webhook_type = 'lead_only' THEN
    NEW.webhook_url := 'https://sifucallwebhook.deno.dev/lead/' || NEW.webhook_token;
  ELSIF NEW.webhook_type = 'lead_and_call' THEN
    NEW.webhook_url := 'https://sifucallwebhook.deno.dev/lead-call/' || NEW.webhook_token;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger to auto-generate webhook URL
CREATE TRIGGER trigger_set_webhook_url
  BEFORE INSERT ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION set_webhook_url();

-- 12. Verify setup
SELECT
  'Webhooks system installed successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'webhooks') as webhooks_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'webhook_logs') as webhook_logs_table_exists;
