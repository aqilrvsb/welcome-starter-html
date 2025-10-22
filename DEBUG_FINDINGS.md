# 🔍 Debug Findings - Audio Issue

## 📊 Current Status

### What's Working ✅
- Call connects successfully
- WebSocket connection established
- First message (ElevenLabs TTS) plays
- Audio chunks received from Twilio
- Azure STT API responds with "Success"
- Credits deducted correctly

### What's NOT Working ❌
- **Azure transcribes empty text** (`"DisplayText": ""`)
- **You hear "heavy rain" sound** (garbled audio from ElevenLabs)
- No AI voice responses (because no transcription = no LLM call)

## 🔍 Azure STT Response (From Logs)

```json
{
  "RecognitionStatus": "Success",
  "Offset": 400000,
  "Duration": 900000,
  "DisplayText": "",  // ❌ EMPTY!
  "NBest": [{
    "Confidence": 0,
    "Lexical": "",
    "ITN": "",
    "MaskedITN": "",
    "Display": ""
  }]
}
```

**Analysis:**
- `RecognitionStatus: "Success"` means Azure received and processed the audio
- `DisplayText: ""` (empty) means **NO SPEECH DETECTED**
- `Confidence: 0` confirms no recognizable speech
- `Duration: 900000` = 0.9 seconds of audio was analyzed

## 🎯 Root Causes

### Issue #1: Audio Quality from Twilio
**Problem:** The audio from Twilio → Edge Function might be:
1. **Too quiet** - Microphone volume too low
2. **Degraded** - Network packet loss
3. **Wrong format** - µ-law encoding issues
4. **Background noise** - Drowning out speech

### Issue #2: ElevenLabs "Heavy Rain" Sound
**Problem:** You're hearing garbled audio instead of clear voice

**Possible causes:**
1. **Format mismatch** - `ulaw_8000` might not be properly supported
2. **Chunk size wrong** - 640 bytes might be incorrect for 8kHz µ-law
3. **Base64 encoding issue** - Audio corrupted during encoding/decoding
4. **Sample rate mismatch** - Twilio expects 8kHz, might be receiving different rate

## 🔧 Fixes Applied

### Fix #1: Increased Audio Buffer
**Before:** 500ms (25 chunks × 20ms)
**After:** 1 second (50 chunks × 20ms)

**Reasoning:** More audio data = better chance of transcription

### Fix #2: Added Debug Logging
Now logs:
- Audio byte count sent to Azure
- Full Azure STT response
- Checks for empty audio data

### Fix #3: Fixed Base64 Decoding
- Decode each chunk individually
- Combine binary data (not base64 strings)

## 🧪 Testing Steps

**After redeploying:**

1. **Check audio size in logs:**
   ```
   🎧 Sending X bytes (50 chunks) to Azure STT
   ```
   - Should be ~8000 bytes (50 chunks × 160 bytes)

2. **Speak clearly and loudly** when you answer the call
   - Wait 1 second before speaking (let buffer fill)
   - Speak for at least 2-3 seconds
   - Use clear, distinct words

3. **Check transcription in logs:**
   ```
   🔍 Azure STT Response: {...}
   ```
   - Look for non-empty `DisplayText`

## 💡 Potential Solutions

### Solution A: Use Deepgram Instead (Recommended)
**Why:** Deepgram is specifically designed for low-quality phone audio

```typescript
// Replace Azure STT with Deepgram
const response = await fetch('https://api.deepgram.com/v1/listen', {
  method: 'POST',
  headers: {
    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
    'Content-Type': 'audio/mulaw'
  },
  body: bytes
});
```

**Advantages:**
- Better at handling phone audio
- Lower latency
- Similar pricing to Azure
- Works well with Twilio

### Solution B: Add WAV Header to Audio
Azure might need proper WAV format:

```typescript
function addWavHeader(audio: Uint8Array): Uint8Array {
  const wavHeader = new Uint8Array(44);
  // ... build WAV header for µ-law 8kHz mono
  return new Uint8Array([...wavHeader, ...audio]);
}
```

### Solution C: Use Twilio's Speech Recognition
Let Twilio handle STT natively:

```xml
<Response>
  <Gather input="speech" speechTimeout="auto" language="ms-MY">
    <Say>Selamat datang!</Say>
  </Gather>
</Response>
```

**Advantages:**
- Native Twilio integration
- No audio streaming needed
- Works perfectly with Twilio audio

### Solution D: Fix ElevenLabs Audio Format
Instead of streaming µ-law, use MP3:

```typescript
output_format: 'mp3_44100_128' // MP3 instead of ulaw_8000
```

Then use `<Play>` verb in Twilio instead of streaming.

## 📈 Next Steps

### Immediate (Test Current Fix)
1. ✅ Redeploy function: `supabase functions deploy ai-call-handler-azure`
2. ✅ Make test call
3. ✅ Check logs for:
   - Audio byte count
   - Azure response with DisplayText
4. ✅ Speak LOUDLY and CLEARLY

### If Still Not Working (Try Alternative)

**Option 1: Switch to Deepgram**
- Sign up at https://deepgram.com
- Get API key
- Replace Azure STT code with Deepgram
- Better for phone audio quality

**Option 2: Use Twilio Native STT**
- Simplest solution
- No WebSocket audio streaming needed
- Let Twilio handle speech → text
- Your edge function only handles LLM + TTS

**Option 3: Debug Audio Quality**
- Save audio bytes to file
- Download and play to check if actual voice is in there
- If silence, problem is microphone/Twilio setup
- If garbled, problem is format conversion

## 🎯 Recommended Path Forward

**I recommend: Switch to Twilio Native STT + Play verb**

**Why:**
1. Eliminates WebSocket audio complexity
2. No format conversion issues
3. Twilio's STT is designed for phone audio
4. Proven to work reliably
5. Similar cost structure

**Would you like me to implement this approach?**

It would simplify the architecture to:
```
Caller → Twilio <Gather> → Your Edge Function (LLM) → Twilio <Say>/<Play> → Caller
```

Much simpler than:
```
Caller → Twilio → WebSocket → Azure STT → LLM → ElevenLabs → WebSocket → Twilio → Caller
```

---

## 📝 Summary

**Current Issue:** Azure can't hear your voice (empty transcription)
**ElevenLabs Issue:** Audio format causing "rain sound"
**Fix Applied:** Larger buffer (1 sec) + more logging
**Next:** Test after redeploy
**If fails:** Consider switching to Twilio native or Deepgram

**Deploy command:**
```bash
supabase functions deploy ai-call-handler-azure
```

Then test and check logs!
