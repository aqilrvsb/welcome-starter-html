-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can delete their own call logs" ON public.call_logs;

-- Create correct DELETE policy for call_logs
CREATE POLICY "Users can delete their own call logs" 
ON public.call_logs 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = call_logs.user_id
  )
);