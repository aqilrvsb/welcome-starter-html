# Run This Migration to Fix Call Costs

## Problem

Error in logs:
```
Could not find the 'azure_stt_cost' column of 'call_costs' in the schema cache
```

The `call_costs` table has `deepgram_cost` but your edge function is trying to save `azure_stt_cost`.

## Solution

Run this SQL migration to rename the column:

### Go to Supabase SQL Editor

https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/sql/new

### Copy and Paste This SQL:

```sql
-- Rename deepgram_cost to azure_stt_cost
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_costs'
    AND column_name = 'deepgram_cost'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_costs'
    AND column_name = 'azure_stt_cost'
  ) THEN
    ALTER TABLE public.call_costs
    RENAME COLUMN deepgram_cost TO azure_stt_cost;

    RAISE NOTICE 'Renamed deepgram_cost to azure_stt_cost';
  ELSE
    RAISE NOTICE 'Column already renamed';
  END IF;
END $$;
```

### Click "Run"

You should see:
```
Success. No rows returned
```

or

```
NOTICE: Renamed deepgram_cost to azure_stt_cost
```

## Verify

After running, check the `call_costs` table:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'call_costs'
ORDER BY ordinal_position;
```

You should see `azure_stt_cost` in the list (not `deepgram_cost`).

## Test

Make another call - it should now save costs properly without errors! ✅

The logs will show:
```
✅ Credits deducted: $X.XX
```

Instead of:
```
❌ Error saving call cost
```
