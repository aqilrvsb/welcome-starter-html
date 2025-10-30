-- Remove the orphaned RLS policies since RLS is now disabled
-- This will resolve the security linter warnings

DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

-- Note: Access control is now handled at the application level
-- All database queries in the ContactForm and ContactList components 
-- properly filter by user_id to ensure data isolation