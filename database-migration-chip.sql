-- Migration Script: Add CHIP Payment Gateway Support to payments table
-- Run this in Supabase SQL Editor

-- Add new columns for CHIP payment gateway
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS chip_purchase_id text UNIQUE,
ADD COLUMN IF NOT EXISTS chip_checkout_url text;

-- Create index for faster lookup by chip_purchase_id (used in webhook)
CREATE INDEX IF NOT EXISTS idx_payments_chip_purchase_id ON public.payments(chip_purchase_id);

-- Add comment to document the columns
COMMENT ON COLUMN public.payments.chip_purchase_id IS 'CHIP Payment Gateway purchase ID (replaces billplz_bill_id for CHIP transactions)';
COMMENT ON COLUMN public.payments.chip_checkout_url IS 'CHIP Payment Gateway checkout URL (replaces billplz_url for CHIP transactions)';

-- Update status constraint to include 'refunded' status (CHIP supports refunds)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text]));

-- Optional: Add index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
  AND column_name IN ('chip_purchase_id', 'chip_checkout_url', 'billplz_bill_id', 'billplz_url', 'status');

-- Show existing indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'payments';
