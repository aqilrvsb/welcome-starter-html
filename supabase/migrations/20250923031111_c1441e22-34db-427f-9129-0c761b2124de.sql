-- Add foreign key relationship between campaigns and prompts
ALTER TABLE public.campaigns 
ADD CONSTRAINT campaigns_prompt_id_fkey 
FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE SET NULL;