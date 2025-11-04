-- Create Base Schema - All existing tables
-- Run this FIRST before credits system migration

-- ============================================
-- 1. Create users table
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email TEXT UNIQUE,
  phone_number TEXT,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- ============================================
-- 2. Create contacts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  product TEXT,
  CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

-- ============================================
-- 3. Create prompts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_name TEXT NOT NULL,
  first_message TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  variables JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT prompts_pkey PRIMARY KEY (id)
);

-- ============================================
-- 4. Create campaigns table
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  prompt_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  total_numbers INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  retry_enabled BOOLEAN DEFAULT false,
  retry_interval_minutes INTEGER DEFAULT 30,
  max_retry_attempts INTEGER DEFAULT 3,
  current_retry_count INTEGER DEFAULT 0,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id)
);

-- ============================================
-- 5. Create subscription_plans table
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR'::text,
  interval_type TEXT NOT NULL CHECK (interval_type = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

-- ============================================
-- 6. Create user_subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan_id UUID,
  status TEXT NOT NULL CHECK (status = ANY (ARRAY['trial'::text, 'active'::text, 'cancelled'::text, 'expired'::text, 'past_due'::text])),
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id)
);

-- ============================================
-- 7. Create payments table
-- ============================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID,
  billplz_bill_id TEXT UNIQUE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR'::text,
  status TEXT NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text])),
  payment_method TEXT,
  billplz_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id)
);

-- ============================================
-- 8. Create call_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  call_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  campaign_id UUID,
  phone_number TEXT,
  vapi_call_id TEXT,
  end_of_call_report JSONB,
  metadata JSONB,
  stage_reached TEXT,
  contact_id UUID,
  captured_data JSONB DEFAULT '{}'::jsonb,
  retry_count INTEGER DEFAULT 0,
  is_retry BOOLEAN DEFAULT false,
  original_campaign_id UUID,
  idsale TEXT,
  customer_name TEXT,
  CONSTRAINT call_logs_pkey PRIMARY KEY (id),
  CONSTRAINT call_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT call_logs_original_campaign_id_fkey FOREIGN KEY (original_campaign_id) REFERENCES public.campaigns(id)
);

-- ============================================
-- 9. Create other tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  voice TEXT,
  language TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  voice_provider TEXT DEFAULT 'elevenlabs'::text,
  CONSTRAINT agents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  vapi_api_key TEXT,
  assistant_id TEXT,
  phone_number_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'not_connected'::text,
  CONSTRAINT api_keys_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT numbers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.phone_config (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  twilio_phone_number TEXT NOT NULL,
  twilio_account_sid TEXT NOT NULL,
  twilio_auth_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  whacenter_device_id TEXT,
  waha_base_url TEXT DEFAULT 'https://waha-plus-production-705f.up.railway.app'::text,
  waha_api_key TEXT,
  waha_session_name TEXT,
  provider TEXT DEFAULT 'whacenter'::text CHECK (provider = ANY (ARRAY['whacenter'::text, 'waha'::text, 'wablas'::text])),
  connection_status TEXT DEFAULT 'disconnected'::text CHECK (connection_status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'scan_qr_code'::text, 'starting'::text, 'stopped'::text])),
  erp_webhook_url TEXT,
  CONSTRAINT phone_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.voice_config (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  country_code TEXT DEFAULT '+60'::text,
  default_name TEXT DEFAULT 'AI Assistant'::text,
  concurrent_limit INTEGER DEFAULT 3 CHECK (concurrent_limit >= 1 AND concurrent_limit <= 10),
  manual_voice_id TEXT,
  provider TEXT DEFAULT '11labs'::text,
  model TEXT DEFAULT 'eleven_flash_v2_5'::text,
  stability NUMERIC DEFAULT 0.8 CHECK (stability >= 0::numeric AND stability <= 1::numeric),
  similarity_boost NUMERIC DEFAULT 1 CHECK (similarity_boost >= 0::numeric AND similarity_boost <= 1::numeric),
  style NUMERIC DEFAULT 0.0 CHECK (style >= 0::numeric AND style <= 1::numeric),
  use_speaker_boost BOOLEAN DEFAULT false,
  speed NUMERIC DEFAULT 0.8 CHECK (speed >= 0.25 AND speed <= 4::numeric),
  optimize_streaming_latency INTEGER DEFAULT 4 CHECK (optimize_streaming_latency >= 0 AND optimize_streaming_latency <= 4),
  auto_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT voice_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL,
  message_text TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id)
);

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create basic RLS policies (allow all for now)
-- ============================================

CREATE POLICY "Allow all operations" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.call_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.numbers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.phone_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.voice_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.subscription_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.user_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Done!
