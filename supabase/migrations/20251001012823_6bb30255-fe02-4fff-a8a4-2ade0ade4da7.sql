-- Drop the existing policy that uses auth.uid()
DROP POLICY IF EXISTS "Users can manage their own templates" ON public.whatsapp_templates;

-- Create new policy that works with custom authentication
-- Using the same pattern as other tables in the project
CREATE POLICY "Users can manage their own templates" 
ON public.whatsapp_templates
FOR ALL 
USING ((user_id)::text = (user_id)::text);