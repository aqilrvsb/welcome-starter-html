# Enable WebRTC in MikoPBX - Step by Step

**This is the solution to replace AudioSocket!**

MikoPBX has native WebRTC/WebSocket support. We'll use this instead of AudioSocket.

---

## Step 1: Enable WebRTC in MikoPBX

1. Log into MikoPBX web interface: http://68.183.177.218
2. Go to **System** → **General Settings** → **SIP**
3. Enable **Use WebRTC**
4. Set **WebSocket Bind Port** to `8089` (default)
5. Enable **WebSocket TLS** if you want `wss://` (recommended)
6. Click **Save**

After this, MikoPBX will listen on:
- `ws://68.183.177.218:8089/asterisk/ws` (HTTP)
- `wss://68.183.177.218:8089/asterisk/ws` (HTTPS)

---

## Step 2: Configure Extension 999 for WebRTC

1. Go to **Connectivity** → **Extensions**
2. Find Extension **999** (or create it if not exists)
3. Set these values:
   - **Extension**: 999
   - **Display Name**: AI Call Handler
   - **Transport**: **WSS** (WebSocket Secure) or **WS**
   - **User ID**: 999
   - **Password**: (set a strong password, e.g., `AIHandler2025@@`)
   - **Codec**: `ulaw,alaw,opus`
4. Click **Save**

---

## Step 3: Configure Firewall (if needed)

If you can't connect, you may need to open port 8089:

```bash
# SSH into Digital Ocean console
ufw allow 8089/tcp
ufw reload
```

---

## Step 4: Test WebSocket Connection

From your local machine, test if WebSocket is accessible:

```bash
# Test with websocat (if you have it)
websocat wss://68.183.177.218:8089/asterisk/ws

# Or use online WebSocket tester:
# https://www.websocket.org/echo.html
# Connect to: wss://68.183.177.218:8089/asterisk/ws
```

If it connects, you'll see WebSocket open!

---

## Architecture with WebRTC

```
Customer Phone (AlienVOIP)
    ↓
MikoPBX (68.183.177.218)
    ↓
Extension 999 (WebRTC)
    ↓
WebSocket (wss://68.183.177.218:8089/asterisk/ws)
    ↓
AI Handler (Deno Deploy) via SIP.js
    ↓
Azure STT + OpenRouter + ElevenLabs
    ↓
Back to customer via same path
```

---

## Next Steps

After enabling WebRTC in MikoPBX:

1. ✅ Enable WebRTC in System Settings
2. ✅ Configure Extension 999 with WebSocket transport
3. ✅ Test WebSocket connectivity
4. ⏳ Deploy new AI handler that uses SIP.js to connect
5. ⏳ Test complete call flow

---

## Important Notes

- Extension 999 will register to MikoPBX via WebSocket from Deno Deploy
- When batch-call-v2 originates a call, it will route to Extension 999
- Extension 999 will be connected to our AI handler via WebSocket
- This eliminates the need for AudioSocket or websocat proxy!

**This is the proper solution for MikoPBX!** 🎉
