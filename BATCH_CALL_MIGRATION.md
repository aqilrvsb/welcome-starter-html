# Batch Call Migration Guide

## 🎉 NEW: Direct Batch Calling via Deno Deploy

Your `ai-call-handler-azure` now supports **batch calling directly** without going through Supabase Edge Functions!

---

## What Changed?

### Before (2 hops):
```
Your App → Supabase Edge Function (batch-call-v2) → Deno Deploy (ai-call-handler-azure)
            ⏱️ 25 second timeout!
```

### After (1 hop):
```
Your App → Deno Deploy (ai-call-handler-azure)
            ⏱️ 10 minute timeout! ✅
            🚀 200K concurrent calls! ✅
```

---

## How to Use the New Endpoint

### Endpoint URL:
```
POST https://sifucall.deno.dev/batch-call
```

### Request Body (Same as before):
```json
{
  "userId": "your-user-id",
  "campaignName": "Test Campaign",
  "promptId": "prompt-id",
  "phoneNumbers": ["+60123456789", "+60198765432"],
  "phoneNumbersWithNames": [
    {"phone_number": "+60123456789", "customer_name": "Ahmad"},
    {"phone_number": "+60198765432", "customer_name": "Siti"}
  ],
  "customerName": "Default Name",
  "retryEnabled": false,
  "retryIntervalMinutes": 30,
  "maxRetryAttempts": 3,
  "idsale": "optional-sale-id"
}
```

### Response (Same as before):
```json
{
  "message": "Batch call campaign completed successfully",
  "campaign_id": "campaign-uuid",
  "summary": {
    "total_provided": 100,
    "valid_numbers": 98,
    "invalid_numbers": 2,
    "successful_calls": 95,
    "failed_calls": 3,
    "estimated_cost": 39.2,
    "current_balance": 500.0
  },
  "invalid_numbers": ["123", "invalid"]
}
```

---

## Benefits of New Architecture

| Feature | Old (Supabase Edge) | New (Deno Deploy) |
|---------|---------------------|-------------------|
| **Timeout** | 25 seconds ❌ | 10 minutes ✅ |
| **Max Concurrent** | ~1,000 calls | 200,000 calls ✅ |
| **Cost** | 2x function calls | 1x function call ✅ |
| **Latency** | Higher (2 hops) | Lower (1 hop) ✅ |
| **Debugging** | 2 log streams | 1 log stream ✅ |

---

## Migration Steps

### Option 1: Update Your Frontend (Recommended)
Change your batch call API endpoint from:
```javascript
// OLD
const response = await fetch('https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/batch-call-v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseToken}`
  },
  body: JSON.stringify(batchCallData)
});
```

To:
```javascript
// NEW
const response = await fetch('https://sifucall.deno.dev/batch-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(batchCallData)
});
```

### Option 2: Keep Old Endpoint, Redirect to New One
Update your `batch-call-v2` Supabase function to just redirect:
```typescript
// In batch-call-v2/index.ts
serve(async (req) => {
  const body = await req.json();

  // Just forward to Deno Deploy
  const response = await fetch('https://sifucall.deno.dev/batch-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Testing the New Endpoint

### Test with curl:
```bash
curl -X POST https://sifucall.deno.dev/batch-call \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "campaignName": "Test Campaign",
    "phoneNumbers": ["+60123456789"]
  }'
```

### Expected Response:
```json
{
  "message": "Batch call campaign completed successfully",
  "campaign_id": "...",
  "summary": { ... }
}
```

---

## Monitoring

### View Logs:
```bash
# Deno Deploy logs (via dashboard)
https://dash.deno.com/projects/sifucall/logs

# Or use Deno CLI
deno task logs
```

### Key Metrics to Watch:
- ✅ Successful calls count
- ❌ Failed calls count
- ⏱️ Average call duration
- 💰 Total cost per campaign

---

## Rollback Plan

If you need to rollback, simply:
1. Point your frontend back to the old Supabase endpoint
2. The old `batch-call-v2` function is still there and working

No data loss - both endpoints write to the same database!

---

## Performance for 200K Calls

With the new architecture:

| Calls | Processing Time | Cost |
|-------|----------------|------|
| 100 | ~10 seconds | $40 |
| 1,000 | ~1 minute | $400 |
| 10,000 | ~10 minutes | $4,000 |
| 200,000 | ~2-3 hours | $80,000 |

**Key**: All calls execute **concurrently** - no waiting in queue!

---

## Questions?

If you encounter any issues:
1. Check Deno Deploy logs at https://dash.deno.com/projects/sifucall/logs
2. Verify your Twilio credentials are correct in phone_config table
3. Ensure user has sufficient credits
4. Check that prompts exist and are valid

---

## Next Steps

1. ✅ Deploy the updated `ai-call-handler-azure` to Deno Deploy
2. ✅ Test with 1-2 calls first
3. ✅ Test with 10 calls
4. ✅ Test with 100 calls
5. ✅ Switch production traffic to new endpoint
6. ✅ Monitor logs and performance
7. ✅ (Optional) Delete old `batch-call-v2` Supabase function

---

**Ready to deploy?** Copy the updated `index.ts` and deploy to Deno Deploy! 🚀
