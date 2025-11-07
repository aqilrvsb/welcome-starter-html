# Simple MikoPBX Setup - No Installation Needed!

You're right - MikoPBX is already complete! We just need to configure it.

## What You Need To Do (Just Web Interface Clicks):

### Step 1: Enable WebRTC (2 minutes)
1. Open MikoPBX: http://68.183.177.218
2. Login with: admin / Dev2025@@
3. Go to: **System** → **General Settings** → **SIP Settings**
4. Find checkbox: **"Enable WebRTC"** ✅ Check it
5. Click **Save**

That's it! MikoPBX now accepts WebSocket connections.

---

### Step 2: Configure Extension 999 (3 minutes)
1. Go to: **Connectivity** → **Extensions**
2. Click **Add New Extension**
3. Fill in:
   - **Extension Number**: 999
   - **Display Name**: AI Call Handler
   - **Password**: AIHandler2025@@
   - **Transport**: Select **WSS** (WebSocket Secure)
4. Click **Save**

Done! Extension 999 is ready.

---

### Step 3: Create Dialplan Rule (2 minutes)
1. Go to: **Routing** → **Dialplan Applications**
2. Create new application:
   - **Extension**: 999
   - **Application Type**: Extension
   - **Forward to**: Extension 999
3. Save

---

## That's All The Configuration!

Now MikoPBX is ready to:
- ✅ Receive calls from AlienVOIP
- ✅ Route to Extension 999
- ✅ Connect Extension 999 via WebSocket to our AI handler

---

## What Happens When Call Comes In:

```
1. Customer calls AlienVOIP number
   ↓
2. AlienVOIP sends to MikoPBX (SIP trunk already configured ✅)
   ↓
3. MikoPBX routes to Extension 999
   ↓
4. Our AI handler (Deno Deploy) is registered as Extension 999 via WebSocket
   ↓
5. Audio flows: Customer ←→ MikoPBX ←→ AI Handler ←→ Azure/OpenRouter/ElevenLabs
```

**No software installation. Just web interface configuration!**

Ready to test?
