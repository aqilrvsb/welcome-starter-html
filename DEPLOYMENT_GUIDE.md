# Deployment Guide - Azure STT Custom AI Pipeline

This guide will help you deploy the custom AI call pipeline using **Azure Speech Services** for transcription, **OpenRouter** for LLM, and **ElevenLabs** for text-to-speech.

## Architecture Overview

```
Caller → Twilio → ai-call-handler-azure (WebSocket)
                      ↓
         Azure STT → OpenRouter LLM → ElevenLabs TTS
                      ↓
         Credits Deducted from User Balance
```

## Cost Structure

| Component | Cost | Notes |
|-----------|------|-------|
| Azure Speech STT | $0.0167/min | $1 per hour |
| OpenRouter (Llama 3.1 70B) | $0.0043/min | ~$0.52 per 1M tokens |
| ElevenLabs TTS | $0.072/min | ~$0.18 per 1K chars |
| Twilio | $0.013/min | Estimated |
| **Total Cost** | **$0.12/min** | What you pay |
| **Charge to Client** | **$0.20/min** | What client pays |
| **Profit** | **$0.08/min** | **40% margin** |

## Step 1: Database Setup ✅ COMPLETED

Your database is already set up with:
- Base schema migration (20251013000000_create_base_schema.sql)
- Credits system migration (20251013000001_add_credits_system.sql)

## Step 2: Get API Keys

### 2.1 Azure Speech Services
1. Go to [Azure Portal](https://portal.azure.com)
2. Create a "Speech Services" resource
3. Navigate to **Keys and Endpoint**
4. Copy:
   - **Key 1** (this is your AZURE_SPEECH_KEY)
   - **Location/Region** (e.g., `southeastasia`, `eastus`)

### 2.2 OpenRouter
1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up or log in
3. Navigate to **Keys** → **Create Key**
4. Copy the API key

### 2.3 ElevenLabs
1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Sign up or log in
3. Navigate to **Profile** → **API Keys**
4. Copy your API key

### 2.4 Billplz (for credits top-up)
1. Go to [Billplz](https://www.billplz.com/)
2. Sign up for a merchant account
3. Go to **Settings** → **API Keys**
4. Copy:
   - **API Secret Key**
   - **Collection ID** (from Collections page)

## Step 3: Deploy Edge Functions

### 3.1 Install Supabase CLI

```bash
# Windows (via npm)
npm install -g supabase

# macOS (via Homebrew)
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### 3.2 Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

### 3.3 Link Your Project

```bash
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"
supabase link --project-ref ahexnoaazbveiyhplfrc
```

### 3.4 Set Environment Variables

Go to your Supabase Dashboard → **Edge Functions** → **Settings** and add these secrets:

```bash
# Azure Speech Services
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=southeastasia

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key_here

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Billplz
BILLPLZ_API_KEY=your_billplz_api_secret_key_here
BILLPLZ_COLLECTION_ID=your_billplz_collection_id_here

# Your app URL (for Billplz redirects)
APP_ORIGIN=https://your-app-domain.com
```

### 3.5 Deploy Edge Functions

```bash
# Deploy ai-call-handler-azure (main WebSocket handler)
supabase functions deploy ai-call-handler-azure

# Deploy batch-call-v2 (initiates calls)
supabase functions deploy batch-call-v2

# Deploy billplz-credits-topup (handles payments)
supabase functions deploy billplz-credits-topup
```

## Step 4: Update Frontend Environment Variables

Update your `.env` file if needed:

```env
VITE_SUPABASE_PROJECT_ID=ahexnoaazbveiyhplfrc
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
VITE_SUPABASE_URL=https://ahexnoaazbveiyhplfrc.supabase.co
```

## Step 5: Test the System

### 5.1 Test Credits Top-Up

1. Navigate to **Credits Top-Up** page
2. Select an amount (e.g., RM50)
3. Complete payment via Billplz/FPX
4. Verify credits are added to your account

### 5.2 Test a Single Call

1. Go to your campaign page
2. Create a test campaign with 1 phone number
3. Make sure you have sufficient credits
4. Initiate the call
5. Check the call log for status

### 5.3 Monitor Logs

```bash
# View logs for ai-call-handler-azure
supabase functions logs ai-call-handler-azure --follow

# View logs for batch-call-v2
supabase functions logs batch-call-v2 --follow

# View logs for billplz-credits-topup
supabase functions logs billplz-credits-topup --follow
```

## Step 6: Verify Cost Tracking

After a call completes:

1. Go to Supabase Dashboard → **Table Editor** → **call_costs**
2. Check the latest record for your test call
3. Verify cost breakdown:
   - `azure_stt_cost`: Should be ~$0.0167/min
   - `llm_cost`: Based on tokens used
   - `tts_cost`: Based on characters spoken
   - `twilio_cost`: ~$0.013/min
   - `total_provider_cost`: Sum of all costs
   - `charged_amount`: What client was charged ($0.20/min)
   - `profit_margin`: Should be positive (~$0.08/min)

## Step 7: Scale Testing

### 7.1 Test with Multiple Concurrent Calls

1. Create a campaign with 10 phone numbers
2. Verify all calls are initiated successfully
3. Monitor credits deduction
4. Check call_costs table for accurate tracking

### 7.2 Load Test (200 clients × 1000 calls)

⚠️ **Warning**: This will consume significant credits and Twilio resources!

1. Ensure you have sufficient Twilio capacity
2. Ensure credits balance is adequate
3. Monitor Supabase edge function metrics
4. Monitor Azure/OpenRouter/ElevenLabs rate limits

## Troubleshooting

### Azure STT Not Working

**Check:**
- Is AZURE_SPEECH_KEY set correctly?
- Is AZURE_SPEECH_REGION correct (e.g., `southeastasia`, not `Southeast Asia`)?
- Check Azure quota limits

**Test Azure Connection:**
```bash
curl -X POST "https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY" \
  -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}" \
  -H "Content-Type: audio/wav" \
  --data-binary @test-audio.wav
```

### OpenRouter Rate Limits

**Symptoms:** Calls failing with 429 errors

**Solution:**
- Upgrade your OpenRouter plan
- Switch to a different model with higher limits

### ElevenLabs Latency

**Symptoms:** Slow responses during calls

**Solution:**
- Already using `eleven_turbo_v2_5` (fastest model)
- Consider reducing `max_tokens` in OpenRouter calls
- Use shorter system prompts

### Credits Not Deducting

**Check:**
1. Go to Supabase Dashboard → **Database** → **Functions**
2. Test `deduct_credits` function manually:
```sql
SELECT deduct_credits(
  'user_id_here'::uuid,
  0.50,
  'test_call_id',
  'Test credit deduction'
);
```

### WebSocket Connection Failing

**Check edge function logs:**
```bash
supabase functions logs ai-call-handler-azure --follow
```

**Common issues:**
- Environment variables not set
- Incorrect Supabase URL in batch-call-v2
- Twilio webhook configuration

## Production Checklist

Before going live with real clients:

- [ ] All API keys are set in Supabase edge function secrets
- [ ] Database migrations completed successfully
- [ ] Credits top-up flow tested end-to-end
- [ ] Single call tested successfully
- [ ] Cost tracking verified in call_costs table
- [ ] Credits deduction working correctly
- [ ] Multiple concurrent calls tested (10+ calls)
- [ ] Error handling tested (insufficient credits, invalid phone numbers)
- [ ] Billplz webhook receiving callbacks
- [ ] Call logs recording properly
- [ ] Transcript storage working
- [ ] Twilio account has sufficient capacity
- [ ] Azure/OpenRouter/ElevenLabs quotas adequate for expected volume
- [ ] Monitoring and alerting set up

## Monitoring & Alerts

### Set up alerts for:
1. **Low credits balance** - Alert clients when balance < $10
2. **High failure rate** - Alert if >20% calls failing
3. **API errors** - Alert on 5xx errors from Azure/OpenRouter/ElevenLabs
4. **Edge function errors** - Monitor Supabase logs

### Key metrics to track:
- Average call duration
- Cost per call
- Profit per call
- Call success rate
- Credits top-up conversion rate
- Monthly recurring revenue per client

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Azure Speech Services**: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
- **OpenRouter**: https://openrouter.ai/docs
- **ElevenLabs**: https://elevenlabs.io/docs
- **Twilio**: https://www.twilio.com/docs

## Next Steps

1. **Deploy edge functions** (Step 3.5)
2. **Set environment variables** (Step 3.4)
3. **Test credits top-up** (Step 5.1)
4. **Test a single call** (Step 5.2)
5. **Verify cost tracking** (Step 6)
6. **Scale to production** (Step 7)

---

🎉 **Congratulations!** Your custom AI call pipeline is ready to deploy. You now have full control over the stack and can generate 40% profit margin on every call.
