-- Add email column to users table
ALTER TABLE public.users 
ADD COLUMN email TEXT;

-- Add unique constraint on email
ALTER TABLE public.users 
ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON public.users(email);