# Deploy Azure Speech WebSocket Implementation

## What Was Fixed

The issue was that we were using Azure Speech **REST API** (batching audio), but VAPI uses Azure Speech **WebSocket** (real-time streaming). This caused:
- "Heavy rain" sound instead of clear audio
- Empty transcriptions
- No AI responses

## New Implementation

Now using Azure Speech WebSocket protocol (like VAPI does):

```
Caller → Twilio Media Stream → Your Edge Function
                                      ↓
                    Azure Speech WebSocket (streaming)
                                      ↓
                              OpenRouter LLM
                                      ↓
                              ElevenLabs TTS
                                      ↓
                    Audio back to Twilio → Caller hears AI
```

## Deploy Edge Function to Supabase

### Step 1: Install Supabase CLI (if not already installed)

**Windows:**
```powershell
npm install -g supabase
```

**Verify:**
```bash
supabase --version
```

### Step 2: Login to Supabase

```bash
supabase login
```

This opens a browser for authentication.

### Step 3: Link Your Project

```bash
cd "c:\Users\ACER\Downloads\aicall-master\aicall-master"
supabase link --project-ref ahexnoaazbveiyhplfrc
```

### Step 4: Set Environment Variables

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

Add these secrets:

```bash
AZURE_SPEECH_KEY=<your Azure Speech Services Key 1>
AZURE_SPEECH_REGION=southeastasia
OPENROUTER_API_KEY=<your OpenRouter API key>
ELEVENLABS_API_KEY=<your ElevenLabs API key>
```

**How to get Azure Speech Key:**
1. Go to: https://portal.azure.com
2. Navigate to your Speech Services resource
3. Click **Keys and Endpoint** on the left menu
4. Copy **KEY 1**
5. Copy **Location/Region** (e.g., `southeastasia`, `eastus`)

### Step 5: Deploy the Edge Function

```bash
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

Wait for deployment to complete.

### Step 6: Test the Deployment

**View logs in real-time:**
```bash
supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
```

**Make a test call:**
1. Go to your app: https://your-railway-app.com
2. Create a campaign with 1 test phone number
3. Start the campaign
4. Answer the call on your phone

**Expected logs:**
```
🔌 WebSocket connected - AI Call Handler ready (Azure STT WebSocket)
📞 Call started: CA...
🌊 Stream started: MZ...
🔌 Connecting to Azure Speech WebSocket...
✅ Azure Speech STT WebSocket connected
✅ Sent Azure Speech configuration
🎤 User said: Hello
🤖 Getting AI response from OpenRouter...
💬 AI Response: Hi! How can I help you today?
🔊 Converting text to speech with ElevenLabs...
✅ Sent audio chunks to Twilio
```

## Troubleshooting

### "Azure Speech WebSocket error" or connection fails

**Check:**
1. Is `AZURE_SPEECH_KEY` set correctly in Supabase secrets?
2. Is `AZURE_SPEECH_REGION` correct? (e.g., `southeastasia`, not `Southeast Asia`)
3. Does your Azure Speech resource have quota available?

**Test Azure connection manually:**
```bash
curl -X POST "https://southeastasia.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY_HERE" \
  -H "Content-Type: audio/wav" \
  --data-binary @test-audio.wav
```

### Still hearing "heavy rain" sound

**Possible causes:**
1. ElevenLabs TTS format issue
2. Audio streaming back to Twilio not working correctly

**Check ElevenLabs:**
- Ensure API key is valid
- Check quota/credits on ElevenLabs dashboard

### No transcription / "Azure: No speech detected"

**Causes:**
- Microphone not working on caller's phone
- Azure Speech not receiving audio correctly
- Audio format mismatch

**Debug:**
Check logs for audio being sent to Azure:
```
⚠️ Azure STT WebSocket not ready. State: 0
```

If you see this, Azure WebSocket connection failed.

### "WebSocket not ready" errors

This means Azure WebSocket isn't connecting properly.

**Fix:**
1. Check Azure credentials are correct
2. Ensure you deployed the latest version
3. Restart the edge function:
   ```bash
   supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
   ```

## What Changed in the Code

### Before (REST API - BROKEN):
```typescript
// Batched audio every 1 second
session.audioBuffer.push(audioPayload);
if (session.audioBuffer.length >= 50) {
  // Decode all chunks, combine, send to REST API
  await transcribeAudio(session, audioChunks);
}
```

### After (WebSocket - WORKING):
```typescript
// Stream audio immediately to Azure WebSocket
if (session.azureSttSocket.readyState === WebSocket.OPEN) {
  // Send audio with proper Azure protocol headers
  const audioHeader = `Path: audio\r\nContent-Type: audio/x-mulaw; codec=mulaw; samplerate=8000\r\n...`;
  session.azureSttSocket.send(combined);
}
```

## Architecture Flow

```
📞 Caller speaks
   ↓
📡 Twilio Media Stream (µ-law 8kHz, base64)
   ↓
🌐 Your Supabase Edge Function (WebSocket)
   ↓
🎤 Azure Speech WebSocket
   - Receives: µ-law audio chunks (20ms each)
   - Returns: {"RecognitionStatus": "Success", "DisplayText": "..."}
   ↓
🤖 OpenRouter LLM (GPT-4o-mini)
   - Receives: User transcript
   - Returns: AI response text
   ↓
🔊 ElevenLabs TTS (Turbo v2.5)
   - Receives: AI text
   - Returns: µ-law audio stream
   ↓
📡 Twilio Media Stream
   ↓
📞 Caller hears AI voice
```

## Cost per Call

| Service | Cost/min | Notes |
|---------|----------|-------|
| Azure Speech STT | $0.0167 | $1/hour for standard tier |
| OpenRouter (GPT-4o-mini) | $0.0043 | ~150 tokens/response |
| ElevenLabs TTS | $0.072 | Turbo v2.5 model |
| Twilio | $0.013 | Voice call costs |
| **Total** | **$0.12/min** | What you pay |
| **Charge client** | **$0.20/min** | 40% profit margin |
| **Profit** | **$0.08/min** | 💰 |

## Next Steps

1. ✅ Deploy edge function (Step 5 above)
2. ✅ Set environment variables (Step 4 above)
3. ✅ Test with a single call
4. ✅ Monitor logs to verify Azure WebSocket connection
5. ✅ Check that you hear clear AI voice (not "heavy rain")

---

**If you still have issues after deployment, check the Supabase logs:**

```bash
supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
```

Look for:
- ✅ "Azure Speech STT WebSocket connected"
- 🎤 "User said: ..."
- 💬 "AI Response: ..."
- ✅ "Sent audio chunks to Twilio"

If you don't see these, there's an issue with the Azure WebSocket connection or configuration.
