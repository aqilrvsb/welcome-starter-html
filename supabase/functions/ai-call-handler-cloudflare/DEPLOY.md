# Deploy to Cloudflare Workers - SIMPLE GUIDE

This is **100% the SAME code** as your Deno Deploy version. Only the platform changed.

Uses:
- Azure Speech (STT)
- OpenRouter GPT-4o-mini (LLM)
- ElevenLabs (TTS)

---

## Step 1: Login to Cloudflare (in PowerShell)

```powershell
$env:CLOUDFLARE_API_TOKEN="jfKEmzgITonhAHHPcGpiJAD6a1CeoLBkKDMAdb72"
wrangler whoami
```

You should see your Cloudflare account info.

---

## Step 2: Navigate to Project

```powershell
cd C:\Users\aqilz\Documents\welcome-starter-html-master\supabase\functions\ai-call-handler-cloudflare
```

---

## Step 3: Install Dependencies

```powershell
npm install
```

---

## Step 4: Set ALL Secrets

You need to set 13 secrets (same as your Deno Deploy environment variables):

```powershell
# Azure Speech
echo "YOUR_AZURE_KEY" | wrangler secret put AZURE_SPEECH_KEY
echo "southeastasia" | wrangler secret put AZURE_SPEECH_REGION

# OpenRouter
echo "YOUR_OPENROUTER_KEY" | wrangler secret put OPENROUTER_API_KEY

# ElevenLabs
echo "YOUR_ELEVENLABS_KEY" | wrangler secret put ELEVENLABS_API_KEY

# Supabase
echo "https://YOUR_PROJECT.supabase.co" | wrangler secret put SUPABASE_URL
echo "YOUR_SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# FreeSWITCH
echo "159.223.45.224" | wrangler secret put FREESWITCH_HOST
echo "8021" | wrangler secret put FREESWITCH_ESL_PORT
echo "ClueCon" | wrangler secret put FREESWITCH_ESL_PASSWORD

# Trial SIP
echo "646006395" | wrangler secret put TRIAL_SIP_USERNAME
echo "Xh7Yk5Ydcg" | wrangler secret put TRIAL_SIP_PASSWORD
echo "sip3.alienvoip.com" | wrangler secret put TRIAL_SIP_PROXY
echo "010894904" | wrangler secret put TRIAL_CALLER_ID
```

**Replace the values with your actual keys!**

---

## Step 5: Deploy

```powershell
wrangler deploy
```

Expected output:
```
✨ Your worker has been deployed
https://ai-call-handler-cloudflare.YOUR_USERNAME.workers.dev
```

**COPY YOUR WORKER URL!**

---

## Step 6: Test WebSocket

In a new terminal:

```powershell
wscat -c wss://ai-call-handler-cloudflare.YOUR_USERNAME.workers.dev
```

If you don't have wscat:
```powershell
npm install -g wscat
```

---

## Step 7: Update FreeSWITCH (Optional)

When you're ready to switch from Deno to Cloudflare:

SSH to FreeSWITCH:
```bash
ssh root@159.223.45.224
```

Edit your code to change WebSocket URL:
```
OLD: wss://ai-call-handler-freeswitch.deno.dev
NEW: wss://ai-call-handler-cloudflare.YOUR_USERNAME.workers.dev
```

---

## Verify Secrets

List all secrets to make sure they're set:

```powershell
wrangler secret list
```

You should see all 13 secrets.

---

## View Logs

Watch real-time logs:

```powershell
wrangler tail
```

---

## That's It!

Your code is now running on Cloudflare Workers with:
- 100% same functionality as Deno
- Azure STT
- OpenRouter LLM
- ElevenLabs TTS
- Same WebSocket handling
- Same audio processing
- Same everything!

Just faster and more scalable! 🚀
