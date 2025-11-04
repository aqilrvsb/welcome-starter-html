# 🚀 Quick Setup Guide - Run Migrations

## ✅ Your Supabase is Connected!

**Project:** ahexnoaazbveiyhplfrc
**URL:** https://ahexnoaazbveiyhplfrc.supabase.co

---

## 📋 Step 1: Run Database Migrations

You need to run 2 SQL migration files. Choose ONE of the options below:

### OPTION A: Use Supabase SQL Editor (Easiest) ⭐

#### Migration 1: Credits System

1. Open: **https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/sql/new**

2. Copy ALL the SQL from this file:
   ```
   supabase/migrations/20251013000001_add_credits_system.sql
   ```

3. Paste into the SQL Editor

4. Click **"RUN"** button

5. ✅ You should see: "Success. No rows returned"

#### Migration 2: API Keys Update

1. Open a NEW query: **https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/sql/new**

2. Copy ALL the SQL from this file:
   ```
   supabase/migrations/20251013000002_update_api_keys_for_custom_pipeline.sql
   ```

3. Paste into the SQL Editor

4. Click **"RUN"** button

5. ✅ You should see: "Success"

---

### OPTION B: Use Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref ahexnoaazbveiyhplfrc

# Run migrations
supabase db push
```

---

## 📊 Step 2: Verify Setup

After running migrations, check if tables were created:

1. Go to: **https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/editor**

2. You should see these NEW tables:
   - ✅ `credits_transactions`
   - ✅ `call_costs`

3. The `users` table should have NEW columns:
   - ✅ `credits_balance`
   - ✅ `total_minutes_used`
   - ✅ `email`
   - ✅ `phone_number`

---

## 🔑 Step 3: Set Environment Variables

Go to: **https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions**

Add these environment variables:

```bash
# Master API Keys (YOU own these)
DEEPGRAM_API_KEY=your_deepgram_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Billplz (already configured)
BILLPLZ_API_KEY=your_billplz_key_here
BILLPLZ_COLLECTION_ID=watojri1

# App Origin
APP_ORIGIN=https://your-app-url.com
```

### How to Get API Keys:

1. **Deepgram**: https://console.deepgram.com/signup
   - Get $200 free credits
   - Copy API key

2. **OpenRouter**: https://openrouter.ai/keys
   - Click "Create Key"
   - Copy API key

3. **ElevenLabs**: https://elevenlabs.io/app/settings/api-keys
   - Click "Create API Key"
   - Copy API key

---

## 🚀 Step 4: Deploy Edge Functions

### Option A: Using Supabase Dashboard (Manual)

For each function, copy the code and create in dashboard:

1. **ai-call-handler**
   - Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/functions
   - Create new function: `ai-call-handler`
   - Copy code from: `supabase/functions/ai-call-handler/index.ts`

2. **batch-call-v2**
   - Create new function: `batch-call-v2`
   - Copy code from: `supabase/functions/batch-call-v2/index.ts`

3. **billplz-credits-topup**
   - Create new function: `billplz-credits-topup`
   - Copy code from: `supabase/functions/billplz-credits-topup/index.ts`

### Option B: Using Supabase CLI (Faster)

```bash
supabase functions deploy ai-call-handler
supabase functions deploy batch-call-v2
supabase functions deploy billplz-credits-topup
```

---

## ✅ Step 5: Verify Everything Works

### Test 1: Check Database

Run this SQL query:

```sql
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('credits_transactions', 'call_costs', 'users');
```

You should see all 3 tables.

### Test 2: Check Functions

Visit these URLs (should return JSON, not 404):

- https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/batch-call-v2
- https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/billplz-credits-topup

---

## 🎉 You're Done!

Your system is now ready with:

- ✅ Credits system
- ✅ Call cost tracking
- ✅ Billplz payments
- ✅ Custom AI call pipeline

### Next Steps:

1. **Test Credits Top-Up**
   - Login to your app
   - Go to "Credits Top-Up"
   - Try buying RM10 credits

2. **Make Test Call**
   - Create a test campaign
   - Add your phone number
   - Start the campaign
   - Check credits are deducted

3. **Scale to 200 Clients!**
   - Onboard clients
   - They top up credits
   - **Make $31,200/month profit!** 💰

---

## 🆘 Need Help?

**Common Issues:**

### Issue: "Function not found"
- Make sure you deployed all 3 edge functions
- Check function names match exactly

### Issue: "Credits not deducted"
- Check if migrations ran successfully
- Verify `credits_transactions` table exists

### Issue: "Payment not working"
- Check BILLPLZ_API_KEY is set correctly
- Verify webhook URL is correct

---

## 📞 Support

If you encounter any issues:

1. Check Supabase logs: **Dashboard → Logs → Edge Functions**
2. Check database errors: **Dashboard → Logs → Postgres Logs**
3. Review `SETUP_CUSTOM_PIPELINE.md` for detailed guide

---

**Ready to launch? Let's make money! 🚀**
