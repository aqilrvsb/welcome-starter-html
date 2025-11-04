# Fixes Applied - Credits-Based Billing

## ✅ Issues Fixed

### 1. Removed Trial/Subscription Checks
**Problem:** "Your trial has expired. Please upgrade to Pro to continue making calls."

**Solution:** Removed all trial expiration checks. Your system now uses **credits-based billing only**.

**Files Updated:**
- ✅ [src/hooks/useBatchCall.ts](src/hooks/useBatchCall.ts:170-171) - Removed `canMakeCalls()` trial check
- ✅ [src/components/campaigns/CampaignActions.tsx](src/components/campaigns/CampaignActions.tsx:105-106) - Removed trial check from repeat campaign

### 2. Updated to batch-call-v2
**Problem:** Code was calling old `batch-call` function (VAPI-based)

**Solution:** All batch calls now use `batch-call-v2` (credits-based with Azure STT)

**Files Updated:**
- ✅ [src/hooks/useBatchCall.ts:188](src/hooks/useBatchCall.ts:188) - Now calls `batch-call-v2`
- ✅ [src/components/campaigns/CampaignActions.tsx:128](src/components/campaigns/CampaignActions.tsx:128) - Now calls `batch-call-v2`

### 3. Credits Check Now in Edge Function
**New Flow:**
1. User makes batch call → frontend calls `batch-call-v2`
2. `batch-call-v2` checks if user has sufficient credits
3. If insufficient credits → returns error: "Insufficient credits. Please top up."
4. If sufficient → makes calls and deducts credits automatically

**No more trial/subscription checks in frontend!**

## 📋 Next Steps (YOU MUST DO)

Your frontend is now fixed and pushed to GitHub. Railway will auto-deploy.

But you still need to **deploy the edge functions** to Supabase:

### Step 1: Install Supabase CLI

**Windows (using Scoop):**
```powershell
# Install Scoop first (if not installed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or download installer:**
https://github.com/supabase/cli/releases/latest

### Step 2: Deploy Functions

```bash
# Login
supabase login

# Navigate to project
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"

# Deploy 3 functions
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
supabase functions deploy batch-call-v2 --project-ref ahexnoaazbveiyhplfrc
supabase functions deploy billplz-credits-topup --project-ref ahexnoaazbveiyhplfrc
```

### Step 3: Set Environment Variables

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

Click **"Show Keys"** in your Azure portal and add:

```
AZURE_SPEECH_KEY=<your KEY 1 from Azure portal>
AZURE_SPEECH_REGION=eastasia
OPENROUTER_API_KEY=<your OpenRouter key>
ELEVENLABS_API_KEY=<your ElevenLabs key>
BILLPLZ_API_KEY=<your Billplz API secret>
BILLPLZ_COLLECTION_ID=<your Billplz collection ID>
APP_ORIGIN=https://your-domain.com
```

### Step 4: Test

**Test Credits Top-Up:**
1. Go to your app → Credits Top-Up page
2. Select RM50
3. Click "Pay with Billplz/FPX"
4. Complete payment
5. Check if credits added to your account

**Test Batch Call:**
1. Create campaign with 1 test phone number
2. Start campaign
3. Should NOT get "trial expired" error anymore
4. If insufficient credits → will show "Insufficient credits. Please top up."

**Check Logs:**
```bash
supabase functions logs batch-call-v2 --project-ref ahexnoaazbveiyhplfrc --follow
```

## 🔧 Troubleshooting

### "Failed to send to edge function" (Credits Top-Up)

**Cause:** `billplz-credits-topup` function not deployed yet

**Fix:** Deploy it using Step 2 above

### "Insufficient credits" Error

**Cause:** User's credits balance is low

**Solution:** User needs to top up credits via Credits Top-Up page

### "WebSocket connection failed"

**Cause:** `ai-call-handler-azure` function not deployed or environment variables not set

**Fix:**
1. Deploy function (Step 2)
2. Set Azure keys (Step 3)

## 📊 How Credits Work Now

### Pricing

| Item | Cost |
|------|------|
| **You charge client** | RM 0.20/min ($0.20/min) |
| **Your actual cost** | RM 0.12/min ($0.12/min) |
| **Your profit** | RM 0.08/min (40% margin) |

### Flow

1. **Client buys credits:**
   - Client goes to Credits Top-Up page
   - Selects amount (e.g., RM100)
   - Pays via Billplz/FPX
   - Credits added automatically after payment

2. **Client makes calls:**
   - Client creates campaign with phone numbers
   - Clicks "Start Campaign"
   - `batch-call-v2` checks if sufficient credits
   - If yes → makes calls
   - Deducts RM 0.20 per minute from client's balance

3. **You make profit:**
   - Client paid you RM 0.20/min
   - Your cost is RM 0.12/min (Azure + OpenRouter + ElevenLabs)
   - You keep RM 0.08/min profit!

### Database Tables

**users table:**
- `credits_balance` - Current credits balance (in RM/USD)
- `total_minutes_used` - Total call minutes used

**credits_transactions table:**
- Logs all credit movements (topup, deduction, refund)

**call_costs table:**
- Tracks exact cost per call:
  - Azure STT cost
  - OpenRouter LLM cost
  - ElevenLabs TTS cost
  - Twilio cost
  - Total cost
  - Amount charged to client
  - Profit margin

## ✅ What's Complete

- ✅ All trial checks removed
- ✅ Updated to `batch-call-v2` (credits-based)
- ✅ Credits system implemented in database
- ✅ Frontend uses credits model
- ✅ All changes pushed to GitHub
- ✅ Railway will auto-deploy frontend

## ⏳ What You Need to Do

- ⏳ Deploy 3 edge functions to Supabase
- ⏳ Set environment variables (Azure keys, etc.)
- ⏳ Test credits top-up flow
- ⏳ Test batch call with credits

---

**Once you deploy the functions and set the environment variables, everything will work!**
