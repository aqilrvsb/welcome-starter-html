-- Feature Requests Table (Client Roadmap)
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN ('general', 'ui', 'feature', 'integration', 'performance', 'bug')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  votes integer DEFAULT 0,
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Pro Account Applications Table
CREATE TABLE IF NOT EXISTS public.pro_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Application Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),

  -- Uploaded Documents (stored as Supabase Storage URLs)
  registration_service_form_url text,
  company_registration_form_url text,
  ssm_document_url text,
  telco_profile_image_url text,

  -- Admin Review
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  admin_notes text,

  -- Timestamps
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- System Settings Table (Dynamic Configuration)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  setting_type text NOT NULL DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description text,
  is_public boolean DEFAULT false, -- Whether non-admin users can read this
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default system settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
  ('pricing_per_minute', '0.15', 'number', 'Price per minute for AI calls (in MYR)', true),
  ('trial_minutes_default', '10.0', 'number', 'Default trial minutes for new users', true),
  ('max_concurrent_calls', '3', 'number', 'Maximum concurrent calls per user', false),
  ('default_sip_proxy_primary', 'sip1.alienvoip.com', 'string', 'Default primary SIP proxy server', false),
  ('default_sip_proxy_secondary', 'sip3.alienvoip.com', 'string', 'Default secondary SIP proxy server', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id ON public.feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON public.feature_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_applications_user_id ON public.pro_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_applications_status ON public.pro_applications(status);
CREATE INDEX IF NOT EXISTS idx_pro_applications_submitted_at ON public.pro_applications(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON public.system_settings(is_public) WHERE is_public = true;

-- Enable Row Level Security (RLS)
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_requests

-- Users can view their own feature requests
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own feature requests
CREATE POLICY "Users can create feature requests"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending feature requests
CREATE POLICY "Users can update own pending requests"
  ON public.feature_requests
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'submitted');

-- Admins can view all feature requests (using email-based admin check)
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- Admins can update any feature request
CREATE POLICY "Admins can update all feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- RLS Policies for pro_applications

-- Users can view their own pro application
CREATE POLICY "Users can view own pro application"
  ON public.pro_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own pro application
CREATE POLICY "Users can create pro application"
  ON public.pro_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending application (for resubmission)
CREATE POLICY "Users can update own pending application"
  ON public.pro_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- Admins can view all pro applications
CREATE POLICY "Admins can view all pro applications"
  ON public.pro_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- Admins can update any pro application
CREATE POLICY "Admins can update all pro applications"
  ON public.pro_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- RLS Policies for system_settings

-- Everyone can read public settings
CREATE POLICY "Anyone can read public settings"
  ON public.system_settings
  FOR SELECT
  USING (is_public = true);

-- Admins can read all settings
CREATE POLICY "Admins can read all settings"
  ON public.system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- Admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON public.system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- Admins can update settings
CREATE POLICY "Admins can update settings"
  ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com')
    )
  );

-- Create function to get public setting value
CREATE OR REPLACE FUNCTION public.get_setting(key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  value text;
BEGIN
  SELECT setting_value INTO value
  FROM public.system_settings
  WHERE setting_key = key AND is_public = true;

  RETURN value;
END;
$$;

-- Create function to get setting as number
CREATE OR REPLACE FUNCTION public.get_setting_numeric(key text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  value text;
BEGIN
  SELECT setting_value INTO value
  FROM public.system_settings
  WHERE setting_key = key AND is_public = true;

  RETURN value::numeric;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_setting(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_setting_numeric(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting_numeric(text) TO anon;
