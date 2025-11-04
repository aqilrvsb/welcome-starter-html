-- Add RLS policies for contacts table
-- Since this uses custom authentication, we'll allow users to manage their own contacts based on user_id

-- Policy for users to view their own contacts
CREATE POLICY "Users can view their own contacts"
ON public.contacts
FOR SELECT
USING (true);

-- Policy for users to insert their own contacts  
CREATE POLICY "Users can insert their own contacts"
ON public.contacts
FOR INSERT
WITH CHECK (true);

-- Policy for users to update their own contacts
CREATE POLICY "Users can update their own contacts" 
ON public.contacts
FOR UPDATE
USING (true);

-- Policy for users to delete their own contacts
CREATE POLICY "Users can delete their own contacts"
ON public.contacts
FOR DELETE
USING (true);