-- Update pro_applications table to use form fields instead of file uploads
-- This migration replaces the file upload fields with text form fields

-- Add new columns for form data
ALTER TABLE pro_applications
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS ic_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_contact TEXT,
ADD COLUMN IF NOT EXISTS masking_number TEXT;

-- Optional: Remove old file URL columns (comment out if you want to keep historical data)
-- ALTER TABLE pro_applications
-- DROP COLUMN IF EXISTS registration_service_form_url,
-- DROP COLUMN IF EXISTS company_registration_form_url,
-- DROP COLUMN IF EXISTS ssm_document_url,
-- DROP COLUMN IF EXISTS telco_profile_image_url;

-- Update the comment on the table
COMMENT ON TABLE pro_applications IS 'Stores Pro account applications with form-based data collection';
