-- Add info column to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS info TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.contacts.info IS 'Additional information or notes about the contact';
