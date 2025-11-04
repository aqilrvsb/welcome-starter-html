-- Update the API key to use the correct Supabase auth user ID
UPDATE public.api_keys 
SET user_id = '7bbd2c3b-a941-42e9-9c75-c118058f240f' 
WHERE user_id = '99d8ecd5-7181-4b38-9360-454299c49470';