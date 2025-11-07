# Current SIP Setup Analysis

## Overview
After analyzing the codebase and FreeSWITCH configuration, here's the actual architecture:

---

## Current Architecture (As Implemented)

### FreeSWITCH Gateway Configuration
- **Single shared gateway**: `AlienVOIP` (UUID: 1360d030-6e0c-4617-83e0-8d80969010cf)
- **Hardcoded credentials**: 646006395@sip3.alienvoip.com
- **Used by**: ALL users (Trial AND Pro)
- **Status**: REGED (Registered and working)

### ESL Client (freeswitch-esl-client.ts)
Line 90 shows all calls use the same gateway:
```typescript
const originateCmd = `api originate {${varString}}sofia/gateway/AlienVOIP/${cleanNumber} &bridge(user/999)`;
```

### ENV Variables in Deno Deploy
The ai-call-handler-freeswitch expects these ENV variables:
- `TRIAL_SIP_USERNAME` (fallback: '646006395')
- `TRIAL_SIP_PASSWORD` (fallback: 'Xh7Yk5Ydcg')
- `TRIAL_SIP_PROXY` (fallback: 'sip3.alienvoip.com')
- `TRIAL_CALLER_ID` (fallback: '010894904')

### Current Behavior
1. **Trial Users**: ENV variables are read but NOT used for SIP routing (only for logging/tracking)
2. **Pro Users**: phone_config table is read but NOT used for SIP routing (only for logging/tracking)
3. **All calls**: Route through the same hardcoded FreeSWITCH gateway

---

## What Needs to be Configured in Deno Deploy

### Required Environment Variables

You need to set these in your Deno Deploy dashboard:

```bash
# FreeSWITCH Connection
FREESWITCH_HOST=178.128.57.106
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=ClueCon

# Trial User SIP Credentials (AlienVOIP shared trunk)
TRIAL_SIP_USERNAME=646006395
TRIAL_SIP_PASSWORD=Xh7Yk5Ydcg
TRIAL_SIP_PROXY=sip3.alienvoip.com
TRIAL_CALLER_ID=010894904

# AI Services
AZURE_SPEECH_KEY=<your-azure-key>
AZURE_SPEECH_REGION=southeastasia
OPENROUTER_API_KEY=<your-openrouter-key>
ELEVENLABS_API_KEY=<your-elevenlabs-key>

# Supabase
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## How to Set Environment Variables in Deno Deploy

### Option 1: Deno Deploy Dashboard
1. Go to https://dash.deno.com/projects/YOUR_PROJECT_NAME/settings
2. Click "Environment Variables"
3. Add each variable with its value
4. Click "Save"

### Option 2: Using Deno Deploy CLI
```bash
# Set multiple variables at once
deno deploy --project=YOUR_PROJECT_NAME \
  --env=FREESWITCH_HOST=178.128.57.106 \
  --env=FREESWITCH_ESL_PORT=8021 \
  --env=FREESWITCH_ESL_PASSWORD=ClueCon \
  --env=TRIAL_SIP_USERNAME=646006395 \
  --env=TRIAL_SIP_PASSWORD=Xh7Yk5Ydcg \
  --env=TRIAL_SIP_PROXY=sip3.alienvoip.com \
  --env=TRIAL_CALLER_ID=010894904
```

---

## Important Notes

### 1. Shared Gateway Architecture
- **Current setup**: ALL users (Trial + Pro) use the same AlienVOIP gateway
- **Gateway credentials**: 646006395@sip3.alienvoip.com
- **This is registered on**: Both FreeSWITCH servers (159.223.45.224 and 178.128.57.106)

### 2. ENV Variables Purpose
The ENV variables in ai-call-handler-freeswitch are used for:
- **Logging/tracking** which account type made the call
- **Metadata** stored in call_logs table
- **Future-proofing** for when you want to implement true dynamic SIP routing

### 3. phone_config Table (Pro Users)
Currently NOT used for actual SIP routing. Pro users still use the shared gateway.

If you want Pro users to use their OWN SIP credentials, you would need to:
1. Create dynamic gateways in FreeSWITCH per Pro user
2. Modify ESL client to use different gateway names
3. Register multiple gateways on FreeSWITCH

---

## Verification Checklist

### ✅ Already Done (Confirmed Working)
- [x] FreeSWITCH server 178.128.57.106 is running
- [x] AlienVOIP gateway is registered (REGED)
- [x] Test call completed successfully (50 seconds, 4 audio chunks)
- [x] ESL port 8021 is accessible
- [x] mod_audio_stream is loaded

### 🔧 To Be Configured in Deno Deploy
- [ ] Set FREESWITCH_HOST=178.128.57.106
- [ ] Set TRIAL_SIP_USERNAME=646006395
- [ ] Set TRIAL_SIP_PASSWORD=Xh7Yk5Ydcg
- [ ] Set TRIAL_SIP_PROXY=sip3.alienvoip.com
- [ ] Set TRIAL_CALLER_ID=010894904
- [ ] Set all AI service API keys (Azure, OpenRouter, ElevenLabs)
- [ ] Set Supabase credentials

---

## Summary

**Your system uses a shared SIP trunk for all users.**

The ENV variables are there to make the system **configurable** without hardcoding values. They serve as:
1. **Single source of truth** for Trial user credentials
2. **Easy updates** without code changes
3. **Environment-specific** configs (dev vs production)

The ai-call-handler-freeswitch reads these ENV variables to:
- Know which SIP credentials were used (for logging)
- Store metadata in database
- Potentially support future multi-tenant SIP routing

But for actual call routing, **all calls use the same FreeSWITCH gateway**: AlienVOIP (646006395@sip3.alienvoip.com)

---

## Recommendation

**Keep the current architecture!** It's simple and works:
- ✅ All users share the same AlienVOIP trunk
- ✅ Costs are tracked per user in database
- ✅ No need for complex multi-gateway setup
- ✅ Easier to maintain and debug

Just ensure the ENV variables in Deno Deploy match your FreeSWITCH setup for consistent logging and metadata.
