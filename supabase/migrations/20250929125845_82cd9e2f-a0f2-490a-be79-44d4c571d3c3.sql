-- Add variables column to prompts table
ALTER TABLE public.prompts 
ADD COLUMN variables jsonb DEFAULT '[]'::jsonb;

-- Update the column comment
COMMENT ON COLUMN public.prompts.variables IS 'Array of variable objects with name and description fields for use in prompt templating';