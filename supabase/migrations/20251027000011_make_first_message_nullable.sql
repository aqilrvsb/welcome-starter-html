-- Make first_message column nullable in prompts table
-- This allows users to create prompts without specifying a first message

ALTER TABLE public.prompts
ALTER COLUMN first_message DROP NOT NULL;

-- Set default empty string for existing NULL values (if any)
UPDATE public.prompts
SET first_message = ''
WHERE first_message IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.prompts.first_message IS 'Optional first message sent when call is answered. Can be empty if not needed.';
