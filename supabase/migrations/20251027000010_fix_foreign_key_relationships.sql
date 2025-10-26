-- Fix foreign key relationships for pro_applications and ensure users relationship works

-- First, check if payments table exists and add foreign key if needed
DO $$
BEGIN
    -- Add foreign key for payments table if it exists and doesn't have one
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        -- Drop existing constraint if it exists
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'payments_user_id_fkey'
                   AND table_name = 'payments') THEN
            ALTER TABLE public.payments DROP CONSTRAINT payments_user_id_fkey;
        END IF;

        -- Add the constraint
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure pro_applications has proper foreign key (it should already exist from migration 20251027000000)
-- But let's make sure it's correct
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'pro_applications_user_id_fkey'
               AND table_name = 'pro_applications') THEN
        ALTER TABLE public.pro_applications DROP CONSTRAINT pro_applications_user_id_fkey;
    END IF;

    ALTER TABLE public.pro_applications
    ADD CONSTRAINT pro_applications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- Ensure credits_transactions has proper foreign key
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credits_transactions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'credits_transactions_user_id_fkey'
                   AND table_name = 'credits_transactions') THEN
            ALTER TABLE public.credits_transactions DROP CONSTRAINT credits_transactions_user_id_fkey;
        END IF;

        ALTER TABLE public.credits_transactions
        ADD CONSTRAINT credits_transactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.pro_applications TO authenticated;
GRANT SELECT ON public.credits_transactions TO authenticated;
