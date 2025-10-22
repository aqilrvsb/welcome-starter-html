# FINAL DEPLOYMENT CHECKLIST
## Azure STT + ElevenLabs TTS - Perfect Delivery

Your system architecture:
```
Caller speaks (Malay)
   ↓ (~200ms)
Azure Speech STT (Singapore) - Transcription
   ↓ (~500ms)
OpenRouter GPT-4o-mini - AI Response
   ↓ (~450ms)
ElevenLabs Turbo v2.5 - Voice Generation
   ↓
Caller hears clear AI voice
```

Total latency: **~1.15 seconds**

---

## Step 1: Verify Environment Variables in Supabase

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

**Check these 4 secrets exist:**

### ✅ AZURE_SPEECH_KEY
- **Value:** Your 32-character Azure Speech Services subscription key
- **Get from:** https://portal.azure.com → Speech Service → Keys and Endpoint → Key 1
- **Format:** `1234567890abcdef1234567890abcdef` (32 chars, no spaces)

### ✅ AZURE_SPEECH_REGION
- **Value:** `southeastasia`
- **Location:** Singapore (fastest for Malaysia)
- **Format:** lowercase, no spaces

### ✅ OPENROUTER_API_KEY
- **Value:** Your OpenRouter API key
- **Get from:** https://openrouter.ai/keys
- **Format:** `sk-or-v1-...`

### ✅ ELEVENLABS_API_KEY
- **Value:** Your ElevenLabs API key
- **Get from:** https://elevenlabs.io/app/settings/api-keys
- **Format:** `sk_...` (starts with sk_)

**IMPORTANT:** Make sure `ELEVENLABS_API_KEY` is set. If empty, system will use Azure TTS instead.

---

## Step 2: Deploy to Supabase

Open PowerShell/Terminal and run:

```bash
# 1. Login to Supabase
supabase login

# 2. Navigate to project
cd "c:\Users\ACER\Downloads\aicall-master\aicall-master"

# 3. Link to your project
supabase link --project-ref ahexnoaazbveiyhplfrc

# 4. Deploy the function
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

**Expected output:**
```
Deploying Function ai-call-handler-azure...
✓ Deployed Function ai-call-handler-azure on project ahexnoaazbveiyhplfrc
```

---

## Step 3: Watch Logs in Real-Time

In another terminal window:

```bash
supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
```

Keep this running while you test!

---

## Step 4: Make a Test Call

1. Go to your app: https://aicallqapro.com
2. Login to your account
3. Create a new campaign:
   - Add 1 phone number (your mobile number)
   - Select a prompt
4. Start the campaign
5. Answer the call on your phone

---

## Step 5: Verify Logs (SUCCESS indicators)

### ✅ Step 1: Azure WebSocket Connection

**Expected:**
```
🔌 Connecting to Azure Speech WebSocket (region: southeastasia)...
🔑 Using subscription key: 12345678...
✅ Azure Speech STT WebSocket connected successfully!
✅ Sent Azure Speech configuration with authentication
```

**❌ If you see:**
```
⚠️ Azure STT WebSocket not ready. State: 3
```

**Problem:** Azure credentials are wrong or Azure WebSocket rejected connection

**Fix:**
- Verify `AZURE_SPEECH_KEY` is correct (32 characters)
- Verify `AZURE_SPEECH_REGION` is `southeastasia`
- Check Azure Portal that Speech Service is active

---

### ✅ Step 2: User Speaks (Transcription)

**Expected:**
```
🎤 User said: Hello, apa khabar?
```

**❌ If you don't see this:**

**Problem:** Azure STT not receiving/transcribing audio

**Possible causes:**
- Microphone not working
- Audio format issue
- Azure WebSocket closed

---

### ✅ Step 3: AI Response

**Expected:**
```
🤖 Getting AI response from OpenRouter...
💬 AI Response: Hello! Saya sihat, terima kasih. Bagaimana saya boleh bantu anda?
```

**❌ If you don't see this:**

**Problem:** OpenRouter API issue

**Fix:**
- Verify `OPENROUTER_API_KEY` is correct
- Check OpenRouter credits/quota

---

### ✅ Step 4: ElevenLabs Voice Generation

**Expected:**
```
🔊 Converting text to speech...
🎤 Using ElevenLabs voice: UcqZLa941Kkt8ZhEEybf, speed: 0.8
📦 Received 12480 bytes of audio from ElevenLabs
✅ Twilio socket is OPEN, sending audio...
✅ Sent 20 audio chunks (12480 bytes total) to Twilio
```

**❌ If you see:**
```
🎤 Using Azure TTS voice: ms-MY-YasminNeural...
```

**Problem:** `ELEVENLABS_API_KEY` is NOT set, system is using Azure TTS instead

**Fix:**
- Add `ELEVENLABS_API_KEY` to Supabase secrets
- Redeploy function

---

### ✅ Step 5: Clear Voice (NO Heavy Rain!)

**What you should hear:**
1. Phone rings
2. You answer
3. AI speaks clearly in Malay: "Hello! Saya sihat..."
4. You speak
5. AI responds clearly
6. **NO heavy rain sound**
7. **NO silence**

**❌ If you hear "heavy rain":**

**Problem:** Audio format issue or incomplete audio

**Possible causes:**
- ElevenLabs API error
- Audio streaming to Twilio failed
- Check logs for errors

---

## Complete Success Logs Example

```
🔌 WebSocket connected - AI Call Handler ready
📞 Call started: CAxxxxx
🌊 Stream started: MZxxxxx
🔌 Connecting to Azure Speech WebSocket (region: southeastasia)...
🔑 Using subscription key: 12345678...
✅ Azure Speech STT WebSocket connected successfully!
✅ Sent Azure Speech configuration with authentication
💬 System Prompt: You are a helpful AI assistant...
🎤 First Message: Hello! How can I help you today?
🔊 Converting text to speech...
🎤 Using ElevenLabs voice: UcqZLa941Kkt8ZhEEybf, speed: 0.8
📦 Received 9600 bytes of audio from ElevenLabs
✅ Sent 15 audio chunks to Twilio
📨 Received message: media
📨 Received message: media
...
🎤 User said: Hello, apa khabar?
🤖 Getting AI response from OpenRouter...
💬 AI Response: Hello! Saya sihat, terima kasih. Bagaimana saya boleh bantu anda?
🔊 Converting text to speech...
🎤 Using ElevenLabs voice: UcqZLa941Kkt8ZhEEybf, speed: 0.8
📦 Received 15360 bytes of audio from ElevenLabs
✅ Sent 24 audio chunks to Twilio
```

---

## Troubleshooting

### Issue 1: "Azure STT WebSocket not ready. State: 3"

**Cause:** Azure WebSocket connection rejected

**Debug:**
1. Check if `AZURE_SPEECH_KEY` is exactly 32 characters
2. Check if `AZURE_SPEECH_REGION` is lowercase `southeastasia`
3. Go to Azure Portal → Your Speech Service → Keys and Endpoint
4. Copy KEY 1 exactly (no extra spaces)
5. Update in Supabase secrets
6. Redeploy function

### Issue 2: No transcription ("User said:" never appears)

**Cause:** Audio not reaching Azure or Azure not recognizing speech

**Debug:**
1. Check microphone is working on phone
2. Check Azure WebSocket is OPEN (State: 1)
3. Speak louder/clearer
4. Check Azure quota not exhausted

### Issue 3: Using Azure TTS instead of ElevenLabs

**Cause:** `ELEVENLABS_API_KEY` is not set or empty

**Fix:**
1. Go to Supabase secrets
2. Add `ELEVENLABS_API_KEY` with your key
3. Redeploy function

### Issue 4: Still hear "heavy rain" sound

**Possible causes:**

**A. First message sounds bad:**
- ElevenLabs API issue
- Check logs for ElevenLabs errors

**B. All audio sounds bad:**
- Twilio streaming issue
- Audio format mismatch

**Debug:**
- Check logs show "Received X bytes of audio from ElevenLabs"
- Check logs show "Sent X audio chunks to Twilio"
- Try different phone number

### Issue 5: OpenRouter API error

**Cause:** Invalid API key or no credits

**Fix:**
1. Go to https://openrouter.ai
2. Check API key is valid
3. Check you have credits
4. Update `OPENROUTER_API_KEY` in Supabase

---

## Cost Per Call (Azure STT + ElevenLabs TTS)

| Service | Cost/Min |
|---------|----------|
| Azure Speech STT (Singapore) | $0.0167 |
| OpenRouter GPT-4o-mini | $0.0043 |
| ElevenLabs Turbo v2.5 | $0.072 |
| Twilio | $0.013 |
| **Total Cost** | **$0.106/min** |
| **Charge Client** | **$0.20/min** |
| **Profit** | **$0.094/min (47%)** |

---

## Final Checklist

Before making the call, verify:

- [ ] All 4 environment variables are set in Supabase
- [ ] `AZURE_SPEECH_REGION` is `southeastasia`
- [ ] `ELEVENLABS_API_KEY` is set (not empty)
- [ ] Function deployed to Supabase successfully
- [ ] Logs terminal is running (`supabase functions logs ... --follow`)

During the call, verify:

- [ ] Logs show "✅ Azure Speech WebSocket connected"
- [ ] Logs show "🎤 User said: ..." (transcription working)
- [ ] Logs show "💬 AI Response: ..." (LLM working)
- [ ] Logs show "Using ElevenLabs voice" (NOT Azure TTS)
- [ ] Logs show "Sent X audio chunks to Twilio"

After the call, verify:

- [ ] You heard clear AI voice (no heavy rain)
- [ ] AI responded to your speech
- [ ] Conversation flowed naturally
- [ ] No long silences

---

## If Everything Fails

If Azure WebSocket still shows State: 3 after deployment:

**ALTERNATIVE SOLUTION:** Use Deepgram STT instead

I can switch to Deepgram + ElevenLabs which is **proven to work** in your codebase:

```
Caller → Deepgram STT (US) → OpenRouter → ElevenLabs → Response
         450ms               500ms           450ms
= Total: ~1.4s (slightly slower but WORKS)
```

Let me know if you want me to implement this fallback!

---

## Contact Info

If still having issues:
1. Share the Supabase logs (full output)
2. Share what you hear on the phone
3. I'll debug from there

**Deploy now:**
```bash
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

Good luck! 🚀
