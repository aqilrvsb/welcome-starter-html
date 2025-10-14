-- Rename deepgram_cost to azure_stt_cost since we're now using Azure Speech Services
-- This migration is safe to run multiple times

DO $$
BEGIN
  -- Check if deepgram_cost exists and azure_stt_cost doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_costs'
    AND column_name = 'deepgram_cost'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_costs'
    AND column_name = 'azure_stt_cost'
  ) THEN
    -- Rename the column
    ALTER TABLE public.call_costs
    RENAME COLUMN deepgram_cost TO azure_stt_cost;

    COMMENT ON COLUMN public.call_costs.azure_stt_cost IS 'Cost of Azure Speech Services STT (formerly Deepgram)';

    RAISE NOTICE 'Renamed deepgram_cost to azure_stt_cost';
  ELSE
    RAISE NOTICE 'Column already renamed or azure_stt_cost already exists';
  END IF;
END $$;
