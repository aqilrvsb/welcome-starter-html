# Complete AlienVOIP + MikoPBX Setup Guide
## 100% Twilio-Free Solution - Just Configuration!

---

## Overview

**What we're building:**
- 200 clients, each with AlienVOIP credentials
- MikoPBX handles all calls (no Twilio!)
- AI processes calls via WebSocket
- Cost: RM0.008/min vs Twilio RM0.03/min = **70% savings**

**No software installation needed - MikoPBX is complete!**

---

## Part 1: Configure MikoPBX (10 minutes)

### A. Enable WebRTC
1. Open http://68.183.177.218
2. Login: admin / Dev2025@@
3. Go to: **System → General Settings → SIP Settings**
4. Check: ✅ **Enable WebRTC**
5. WebSocket Port: **8089** (default)
6. Click **Save**

### B. Configure Extension 999 (AI Handler)
1. Go to: **Connectivity → Extensions**
2. Click **Add New Extension**
3. Settings:
   ```
   Extension Number: 999
   Display Name: AI Call Handler
   Password: AIHandler2025@@
   Transport: WSS (WebSocket Secure)
   Codecs: ulaw, alaw
   ```
4. Click **Save**

### C. Verify AlienVOIP Trunk (Already Done ✅)
1. Go to: **Connectivity → Providers**
2. You should see **AlienVOIP** provider (green status)
3. Settings should show:
   ```
   Host: sip1.alienvoip.com
   Username: 646006395
   Password: Xh7Yk5Ydcg
   ```

### D. Configure Outbound Route
1. Go to: **Routing → Outbound Routes**
2. Ensure calls route through **AlienVOIP** provider
3. Pattern: All outgoing calls

---

## Part 2: Database Already Updated ✅

Your database already has:
- ✅ `mikopbx_url` field
- ✅ `sip_proxy_primary` field
- ✅ `sip_username` field
- ✅ `sip_password` field
- ✅ All Twilio fields removed

Each of your 200 clients will enter their AlienVOIP credentials in Settings.

---

## Part 3: Frontend Already Updated ✅

Your frontend already shows AlienVOIP configuration:
- ✅ [src/components/settings/AiConfigForm.tsx](src/components/settings/AiConfigForm.tsx)
- ✅ [src/components/settings/PhoneConfigForm.tsx](src/components/settings/PhoneConfigForm.tsx)

Clients will see:
```
MikoPBX URL: http://68.183.177.218
Primary SIP Proxy: sip1.alienvoip.com
SIP Username: [their username]
SIP Password: [their password]
```

---

## Part 4: How It Works

### When Client Clicks "Batch Call":

```
1. Frontend → Deno Deploy (batch-call-v2)
   ↓
2. batch-call-v2 → MikoPBX AMI (Originate Call)
   Channel: SIP/AlienVOIP/[phone_number]
   Extension: 999
   ↓
3. MikoPBX → AlienVOIP SIP Trunk
   (Outgoing call to customer)
   ↓
4. Customer answers
   ↓
5. MikoPBX routes to Extension 999
   ↓
6. Extension 999 connected to AI Handler (Deno Deploy)
   via WebSocket: wss://68.183.177.218:8089/asterisk/ws
   ↓
7. AI Handler processes audio:
   - Customer speaks → Azure STT → Text
   - Text → OpenRouter GPT → Response
   - Response → ElevenLabs → Audio
   - Audio → Customer
```

---

## Part 5: Deploy AI Handler

### Option A: Manual Deploy to Deno Deploy

```bash
cd supabase/functions/ai-call-handler-webrtc
deno deploy --project=your-project-name index.ts
```

### Option B: GitHub Actions (Automatic)

Push to GitHub, Deno Deploy auto-deploys.

---

## Part 6: Test The System

### Test 1: Verify MikoPBX WebSocket

```bash
# Test WebSocket is accessible
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://68.183.177.218:8089/asterisk/ws
```

Expected: `101 Switching Protocols`

### Test 2: Make Test Call

1. Go to your frontend: Settings → Batch Call
2. Enter test phone number
3. Click "Start Call"
4. Check logs:
   - Supabase logs: batch-call-v2 function
   - MikoPBX logs: Call origination
   - Deno Deploy logs: AI handler connection

---

## Part 7: Firewall (If Needed)

If WebSocket connection fails, open port 8089:

```bash
# In Digital Ocean console
ufw allow 8089/tcp
ufw reload
ufw status
```

---

## Part 8: For Each Client (200 Users)

Each client needs to enter THEIR AlienVOIP credentials:

1. Client logs in to your system
2. Goes to: **Settings → AI Configuration**
3. Enters:
   ```
   MikoPBX URL: http://68.183.177.218 (auto-filled)
   Primary SIP Proxy: sip1.alienvoip.com (or sip3.alienvoip.com)
   SIP Username: [their AlienVOIP username]
   SIP Password: [their AlienVOIP password]
   ```
4. Clicks **Save**

Now that client can make calls using their AlienVOIP account!

---

## Cost Savings

**Before (Twilio):**
- RM0.03/min telephony
- VAPI RM0.50/min AI
- **Total: RM0.53/min**

**After (AlienVOIP + MikoPBX):**
- RM0.008/min telephony (AlienVOIP)
- Your own AI pipeline (Azure + OpenRouter + ElevenLabs)
- **Total: ~RM0.05/min**

**Savings: 90% cheaper!** 🎉

---

## Troubleshooting

### WebSocket Connection Failed
- Check firewall: `ufw status`
- Verify WebRTC enabled in MikoPBX
- Check Extension 999 transport = WSS

### Call Not Routing to Extension 999
- Check dialplan in MikoPBX
- Verify AMI credentials in batch-call-v2
- Check MikoPBX logs: `/var/log/asterisk/full`

### No Audio
- Verify Extension 999 codec = ulaw
- Check NAT settings in MikoPBX
- Verify WebSocket audio streaming in AI handler

---

## Next Steps

1. ✅ Configure MikoPBX (Steps in Part 1)
2. ✅ Test WebSocket connection
3. ✅ Deploy AI handler to Deno Deploy
4. ✅ Make test call
5. ✅ Onboard 200 clients with their AlienVOIP credentials

**No Twilio. No AudioSocket installation. Just configuration!** 🚀
