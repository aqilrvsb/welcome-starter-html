-- Add CHIP transaction ID column to payments table for easy reference lookup
-- This allows clients to provide the transaction ID when contacting support

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS chip_transaction_id TEXT;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_payments_chip_transaction_id ON public.payments(chip_transaction_id);

-- Add comment
COMMENT ON COLUMN public.payments.chip_transaction_id IS 'CHIP Payment Gateway transaction ID for reference lookup';
