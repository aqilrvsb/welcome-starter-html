-- Add DELETE policy for call_logs table so users can delete their own call logs
CREATE POLICY "Users can delete their own call logs" 
ON public.call_logs 
FOR DELETE 
USING (user_id::text = user_id::text);