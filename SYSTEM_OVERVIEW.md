# 🎯 AI Call System - Complete Overview

## 📊 Your System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      GITHUB REPOSITORY                          │
│              https://github.com/aqilrvsb/aicall                 │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │   Frontend       │         │  Edge Functions  │             │
│  │   (React + TS)   │         │  (Deno/TypeScript)│            │
│  │                  │         │                  │             │
│  │  • Dashboard     │         │  • batch-call-v2 │             │
│  │  • Campaigns     │         │  • ai-call-handler│            │
│  │  • Contacts      │         │  • billplz-topup │             │
│  │  • Credits       │         │                  │             │
│  └──────────────────┘         └──────────────────┘             │
└───────┬───────────────────────────────┬─────────────────────────┘
        │                               │
        │ Auto Deploy                   │ Manual Deploy
        ↓                               ↓
┌──────────────────┐          ┌──────────────────────┐
│    RAILWAY       │          │     SUPABASE         │
│   (Frontend)     │          │  (Backend + DB)      │
│                  │          │                      │
│  • Static Host   │◄────────►│  • PostgreSQL DB     │
│  • Auto Deploy   │          │  • Edge Functions    │
│  • Free Tier     │          │  • Auth              │
└──────────────────┘          │  • Storage           │
                              └──────────────────────┘
```

## 🔄 Call Flow (How It Works)

### 1. User Creates Campaign
```
User → Dashboard → Create Campaign
  ↓
Select contacts (phone numbers)
  ↓
Select AI prompt
  ↓
Click "Start Campaign"
  ↓
Frontend → Supabase Edge Function (batch-call-v2)
```

### 2. Batch Call Initiation
```
batch-call-v2 Function:
  ├─ Check user credits balance
  ├─ Validate phone numbers
  ├─ Create campaign record in DB
  ├─ For each phone number:
  │   ├─ Generate TwiML with WebSocket URL
  │   ├─ Call Twilio API to make call
  │   └─ Log call record
  └─ Return success/failure summary
```

### 3. Live Call Processing
```
Caller answers phone
  ↓
Twilio connects to WebSocket (ai-call-handler-azure)
  ↓
Edge Function sends first message via ElevenLabs TTS
  ↓
┌────────────────────────────────────────┐
│         CONVERSATION LOOP              │
├────────────────────────────────────────┤
│  1. Caller speaks                      │
│     ↓                                  │
│  2. Audio → Azure Speech STT → Text    │
│     ↓                                  │
│  3. Text → OpenRouter LLM → Response   │
│     ↓                                  │
│  4. Response → ElevenLabs TTS → Audio  │
│     ↓                                  │
│  5. Audio → Back to caller             │
│     ↓                                  │
│  6. Repeat until call ends             │
└────────────────────────────────────────┘
  ↓
Call ends
  ↓
Calculate costs & deduct credits
  ↓
Save transcript & call log to DB
```

## 💰 Economics (Your Business Model)

### Cost Structure (Per Minute)
| Component | Provider | Your Cost | Notes |
|-----------|----------|-----------|-------|
| Speech-to-Text | Azure Speech | $0.0167 | $1 per hour |
| LLM | OpenRouter (GPT-4o-mini) | $0.0043 | ~$0.52 per 1M tokens |
| Text-to-Speech | ElevenLabs | $0.072 | ~$0.18 per 1K chars |
| Phone Call | Twilio (client's account) | $0.013 | Client pays directly |
| **Total Cost** | **YOU pay** | **$0.12/min** | **Your expense** |
| **Charge to Client** | **Client pays YOU** | **$0.20/min** | **Your revenue** |
| **Profit** | **You keep** | **$0.08/min** | **40% margin** 🎉 |

### Revenue Example
```
1 Client makes 1,000 calls × 2 minutes average:
  Revenue: 2,000 minutes × $0.20 = $400
  Cost:    2,000 minutes × $0.12 = $240
  Profit:  $400 - $240 = $160 (40% margin)

200 Clients × 1,000 calls each:
  Revenue: $80,000
  Cost:    $48,000
  Profit:  $32,000 per month 💰
```

## 🔑 API Keys You Need

### Master Keys (YOU own - stored in Supabase)
1. **Azure Speech Services**
   - Get from: https://portal.azure.com
   - Navigate to: Speech Services → Keys and Endpoint
   - Need: `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`

2. **OpenRouter**
   - Get from: https://openrouter.ai/keys
   - Need: `OPENROUTER_API_KEY`

3. **ElevenLabs**
   - Get from: https://elevenlabs.io/profile
   - Navigate to: API Keys
   - Need: `ELEVENLABS_API_KEY`

4. **Billplz (for payments)**
   - Get from: https://www.billplz.com/settings
   - Need: `BILLPLZ_API_KEY` and `BILLPLZ_COLLECTION_ID`

### Client Keys (Each client provides)
1. **Twilio Account SID**
2. **Twilio Auth Token**
3. **Twilio Phone Number**

**Important:** Clients NEVER see your master API keys!

## 📦 Database Schema

### Core Tables
```sql
-- User accounts
users
  ├─ id (UUID)
  ├─ username
  ├─ password_hash
  ├─ credits_balance (DECIMAL) ← Client's current balance
  └─ total_minutes_used

-- Campaigns
campaigns
  ├─ id (UUID)
  ├─ user_id (→ users.id)
  ├─ campaign_name
  ├─ prompt_id (→ prompts.id)
  ├─ status (in_progress | completed | failed)
  ├─ total_numbers
  ├─ successful_calls
  └─ failed_calls

-- AI Prompts
prompts
  ├─ id (UUID)
  ├─ user_id (→ users.id)
  ├─ name
  ├─ system_prompt ← AI personality/instructions
  ├─ first_message ← What AI says first
  └─ variables ← {{customer_name}}, etc.

-- Call Logs
call_logs
  ├─ id (UUID)
  ├─ campaign_id (→ campaigns.id)
  ├─ user_id (→ users.id)
  ├─ call_id (Twilio Call SID)
  ├─ phone_number
  ├─ status (initiated | in-progress | completed | failed)
  ├─ start_time
  ├─ end_time
  └─ metadata (transcript, etc.)

-- Cost Tracking
call_costs
  ├─ id (UUID)
  ├─ call_id (→ call_logs.call_id)
  ├─ user_id (→ users.id)
  ├─ duration_minutes
  ├─ azure_stt_cost ← Breakdown
  ├─ llm_cost
  ├─ tts_cost
  ├─ twilio_cost
  ├─ total_provider_cost ← Sum of above
  ├─ charged_amount ← What client paid
  ├─ profit_margin ← Your profit
  └─ status (pending | charged | failed)

-- Credits System
credits_transactions
  ├─ id (UUID)
  ├─ user_id (→ users.id)
  ├─ amount (+ for topup, - for deduction)
  ├─ transaction_type (topup | deduction | refund | bonus)
  ├─ balance_before
  ├─ balance_after
  ├─ reference_id (payment_id or call_id)
  └─ description

-- Client Config
phone_config
  ├─ user_id (→ users.id)
  ├─ twilio_account_sid ← Client's Twilio SID
  ├─ twilio_auth_token ← Client's Twilio token
  └─ twilio_phone_number ← Client's Twilio number

voice_config
  ├─ user_id (→ users.id)
  ├─ manual_voice_id ← ElevenLabs voice ID
  └─ speed ← Voice speed (0.5 to 1.5)
```

## 🔐 Security

### Row Level Security (RLS)
```sql
-- Example: Users can only see their own data
CREATE POLICY "Users view own campaigns"
ON campaigns FOR SELECT
USING (auth.uid() = user_id);
```

### API Key Protection
- Master keys stored as **Supabase Edge Function secrets** (encrypted)
- Client Twilio keys stored in database (encrypted at rest)
- Frontend NEVER sees any API keys

### Credits Security
- Atomic transactions (can't overdraw)
- All movements logged in `credits_transactions`
- Deduction happens AFTER call completes

## 🐛 The Bug & The Fix

### The Problem You Reported
**Symptom:** "When I call batch, it calls my number working, but I hear rain sound for 5 seconds and then silence. No AI voice."

**Root Cause:**
1. ❌ Azure Speech STT WebSocket was using wrong protocol
2. ❌ Audio format was incorrect (JSON instead of binary)
3. ❌ Session management had bugs
4. ❌ No proper error handling

**Result:**
- Call connected ✅
- First message played... but in wrong format → "rain sound" 🌧️
- No transcription → No AI response → Silence 🔇

### The Fix Applied
**Changes in:** `supabase/functions/ai-call-handler-azure/index.ts`

1. ✅ Switched to Azure Speech REST API (more reliable than WebSocket)
2. ✅ Added audio buffering (500ms chunks instead of 20ms)
3. ✅ Fixed session management (proper streamSid lookup)
4. ✅ Enhanced error handling (detailed logs)
5. ✅ Validated WebSocket state before sending audio

**New Flow:**
```
Caller speaks
  ↓
Buffer 500ms of audio (25 × 20ms chunks)
  ↓
Send to Azure Speech REST API
  ↓
Get transcription immediately
  ↓
Process with LLM → TTS → Send to caller
  ↓
Clear, natural AI voice! ✅
```

## 🚀 Deployment Process

### Current Setup
```
Code changes → Push to GitHub → Railway auto-deploys frontend ✅
                              ↘
                                Supabase functions need MANUAL deploy ⚠️
```

### How to Deploy Edge Function Fix

**Step 1: Install Supabase CLI**
```bash
# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Mac (via Homebrew)
brew install supabase/tap/supabase

# Linux
brew install supabase/tap/supabase
```

**Step 2: Login & Deploy**
```bash
# Login to Supabase
supabase login

# Navigate to project
cd c:\Users\ACER\Downloads\aicall-master\aicall-master

# Deploy the FIXED function
supabase functions deploy ai-call-handler-azure

# Verify it's deployed
supabase functions list
```

**Step 3: Set Environment Variables**
Go to Supabase Dashboard → Edge Functions → Settings:
```bash
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=southeastasia
OPENROUTER_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
BILLPLZ_API_KEY=your_key_here
BILLPLZ_COLLECTION_ID=your_collection_here
APP_ORIGIN=https://your-railway-domain.railway.app
```

**Step 4: Test**
1. Create a test campaign with YOUR phone number
2. Start the campaign
3. Answer the call
4. **Expected:** Clear AI voice, natural conversation
5. **Not expected:** Rain sound or silence

**Step 5: Monitor**
```bash
supabase functions logs ai-call-handler-azure --follow
```

Look for:
- ✅ "🔌 WebSocket connected - AI Call Handler ready (Azure STT Fixed)"
- ✅ "📞 Call started"
- ✅ "🔊 Converting text to speech"
- ✅ "✅ Sent X audio chunks to Twilio"
- ✅ "🎤 User said: [transcript]"
- ✅ "💬 AI Response: [response]"

## 📊 Monitoring & Analytics

### Key Metrics to Track
```sql
-- Daily revenue
SELECT DATE(charged_at) as date,
       SUM(charged_amount) as revenue,
       SUM(total_provider_cost) as cost,
       SUM(profit_margin) as profit
FROM call_costs
WHERE charged_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(charged_at)
ORDER BY date DESC;

-- Top users by usage
SELECT u.username,
       COUNT(c.id) as total_calls,
       SUM(c.duration_minutes) as total_minutes,
       SUM(c.charged_amount) as total_spent
FROM call_costs c
JOIN users u ON c.user_id = u.id
WHERE c.charged_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.username
ORDER BY total_spent DESC
LIMIT 10;

-- Call success rate
SELECT
  COUNT(CASE WHEN status = 'completed' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100 as success_rate_pct
FROM call_logs
WHERE start_time >= CURRENT_DATE - INTERVAL '7 days';
```

### Dashboard (Frontend)
- Real-time call status
- Campaign progress
- Credits balance
- Call history with transcripts
- Cost analytics

## 🎯 Next Steps

### Immediate (Must Do)
1. ✅ Deploy fixed `ai-call-handler-azure` to Supabase
2. ✅ Set all environment variables
3. ✅ Test with a single call
4. ✅ Verify logs show correct flow

### Short Term (This Week)
1. Test with 10 calls simultaneously
2. Monitor error rates
3. Fine-tune AI prompts
4. Test credits deduction accuracy

### Medium Term (This Month)
1. Onboard first paying client
2. Set up monitoring alerts
3. Create client documentation
4. Test scaling (100+ concurrent calls)

### Long Term (Growth)
1. Scale to 10 clients
2. Optimize costs further
3. Add new features (SMS, WhatsApp)
4. Build analytics dashboard

## 📚 Documentation Files

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
2. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - How to deploy everything
3. **[FIX_AUDIO_ISSUE.md](FIX_AUDIO_ISSUE.md)** - Details on the audio bug fix
4. **[FIXES_APPLIED.md](FIXES_APPLIED.md)** - Previous fixes (credits system)
5. **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)** - This file!

## 🆘 Troubleshooting

### Issue: "Rain sound" still happening

**Check:**
1. Did you deploy the fixed function?
   ```bash
   supabase functions list
   # Look for ai-call-handler-azure with recent timestamp
   ```

2. Are environment variables set?
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Verify all keys are present

3. Check logs:
   ```bash
   supabase functions logs ai-call-handler-azure --follow
   ```

### Issue: No AI response at all

**Check:**
1. Azure Speech API key:
   ```bash
   # Test in terminal
   curl -X POST "https://southeastasia.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY" \
     -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
     -H "Content-Type: audio/wav" \
     --data-binary @test.wav
   ```

2. OpenRouter API key:
   - Visit https://openrouter.ai/activity
   - Check if requests are going through

3. ElevenLabs API key:
   - Visit https://elevenlabs.io/usage
   - Check if TTS requests are logged

### Issue: Credits not deducting

**Check:**
1. Database function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'deduct_credits';
   ```

2. Test manually:
   ```sql
   SELECT deduct_credits(
     'user-id-here'::uuid,
     0.50,
     'test-call-id',
     'Test deduction'
   );
   ```

## 🎉 Success Criteria

You'll know everything is working when:

1. ✅ Call connects immediately
2. ✅ AI speaks first message clearly (no rain sound)
3. ✅ AI understands what you say
4. ✅ AI responds naturally
5. ✅ Conversation flows smoothly
6. ✅ Call ends cleanly
7. ✅ Transcript saved in database
8. ✅ Credits deducted correctly
9. ✅ Cost tracking accurate
10. ✅ No errors in logs

---

## 📞 Support

**Logs are your best friend:**
```bash
supabase functions logs ai-call-handler-azure --follow
```

**Need help?**
1. Check logs first
2. Look for ❌ error emojis
3. Read the error message carefully
4. Search this documentation
5. Share relevant log lines if stuck

**Quick Links:**
- Supabase Dashboard: https://supabase.com/dashboard
- Azure Portal: https://portal.azure.com
- OpenRouter: https://openrouter.ai
- ElevenLabs: https://elevenlabs.io
- Twilio: https://console.twilio.com

---

**System Status:** 🟢 Ready to deploy fix
**Next Action:** Deploy `ai-call-handler-azure` to Supabase
**Expected Result:** Clear AI voice, natural conversation, no more rain sound! 🎉
