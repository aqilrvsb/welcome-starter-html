# Quick Deploy Guide - Azure WebSocket Fix

## Critical Fix Applied

**Problem:** Azure WebSocket was in State 3 (CLOSED) - never connecting
**Cause:** Wrong authentication method
**Fix:** Pass `Ocp-Apim-Subscription-Key` in query parameter instead of header

## Deploy Now (3 Steps)

### 1. Get Your Azure Speech Key

Go to: https://portal.azure.com → Your Speech Service → Keys and Endpoint

You need:
- **Key 1** (32-character string)
- **Location/Region** (e.g., `southeastasia`, `eastus`)

### 2. Set Environment Variables in Supabase

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

Add these secrets:

```
AZURE_SPEECH_KEY = <paste your Key 1>
AZURE_SPEECH_REGION = southeastasia
OPENROUTER_API_KEY = <your OpenRouter key>
ELEVENLABS_API_KEY = <your ElevenLabs key>
```

### 3. Deploy the Edge Function

```bash
supabase login
cd "c:\Users\ACER\Downloads\aicall-master\aicall-master"
supabase link --project-ref ahexnoaazbveiyhplfrc
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

## Test It

Watch logs:
```bash
supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
```

Expected logs:
```
✅ Azure Speech STT WebSocket connected successfully!
🎤 User said: Hello
💬 AI Response: Hi! How can I help you?
✅ Sent audio chunks to Twilio
```

Done!
