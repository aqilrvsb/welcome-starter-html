# Test Azure Speech Credentials

## Quick Test

Run this in PowerShell (replace with your actual keys):

```powershell
$AZURE_KEY = "your-azure-key-here"
$AZURE_REGION = "southeastasia"

# Test REST API (simple)
curl -X POST "https://$AZURE_REGION.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY" `
  -H "Ocp-Apim-Subscription-Key: $AZURE_KEY" `
  -H "Content-Type: audio/wav" `
  --data-binary "@test.wav"
```

**Expected result:**
- ✅ If works: You'll see JSON response
- ❌ If fails: "401 Unauthorized" or "403 Forbidden"

## If 401/403 Error

Your Azure credentials are wrong. Get correct ones:

1. Go to: https://portal.azure.com
2. Find your Speech Service resource
3. Click "Keys and Endpoint"
4. Copy **Key 1** (32 characters)
5. Copy **Location/Region** (e.g., `southeastasia`)

## If You Don't Have Test Audio

The problem is probably:
1. Azure Speech Service doesn't exist
2. Azure Speech Service is disabled
3. Wrong subscription key
4. Wrong region

## My Suggestion

**Let's switch to Deepgram + ElevenLabs instead**

This will:
- ✅ Fix "heavy rain" issue immediately
- ✅ Work with your existing ElevenLabs setup
- ✅ No Azure authentication headaches
- ✅ Actually cheaper! ($0.0043 vs $0.0167 for STT)

Should I create a working version with Deepgram + ElevenLabs?
