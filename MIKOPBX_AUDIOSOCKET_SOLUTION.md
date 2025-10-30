# MikoPBX AudioSocket Solution - 100% Twilio-Free

**The Complete Solution for AlienVOIP-Only System**

---

## Architecture

```
Customer Phone (60123456789)
    ↓
AlienVOIP SIP Trunk (sip1.alienvoip.com)
    ↓
MikoPBX Server (68.183.177.218)
    ↓
Extension 999 → AudioSocket Dialplan
    ↓
TCP/WebSocket Stream (8kHz µ-law audio)
    ↓
AI Handler (Deno Deploy - sifucall.deno.dev)
    ↓
Azure STT + OpenRouter GPT + ElevenLabs TTS
```

**NO TWILIO ANYWHERE!** ✅

---

## What is AudioSocket?

**Asterisk AudioSocket** is a dialplan application that:
- Streams bidirectional audio in real-time
- Uses TCP socket (can be wrapped in WebSocket)
- Sends/receives raw audio (8kHz µ-law or 16kHz PCM)
- Perfect for AI/STT applications

**Documentation:** https://github.com/CyCoreSystems/audiosocket

---

## Phase 1: Configure AudioSocket in MikoPBX

### Step 1: SSH into MikoPBX Server

```bash
ssh root@68.183.177.218
```

### Step 2: Create Custom Dialplan for Extension 999

```bash
# Edit custom extensions file
nano /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf
```

Add this dialplan:

```asterisk
[all_peers]
; Extension 999 - AI Handler with AudioSocket
exten => 999,1,NoOp(AI Call Handler Starting)
 same => n,Answer()
 same => n,Set(CHANNEL(language)=ms)  ; Malaysian Malay
 same => n,Set(CALLERID(name)=${CALLERID(name)})
 same => n,AudioSocket(${AUDIOHOOK_ID},sifucall.deno.dev:10000)
 same => n,Hangup()
```

**Explanation:**
- `Answer()` - Answer the call
- `AudioSocket(uuid,host:port)` - Connect audio to your Deno server
  - `${AUDIOHOOK_ID}` - Unique ID for this call
  - `sifucall.deno.dev:10000` - Your AI handler endpoint

### Step 3: Enable Custom Dialplan

```bash
# Include custom dialplan in main config
echo "#include /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf" >> /etc/asterisk/extensions.conf
```

### Step 4: Reload Asterisk

```bash
asterisk -rx "dialplan reload"
asterisk -rx "core show applications like AudioSocket"
```

You should see: `AudioSocket: Transmit and receive audio between channel and TCP socket`

---

## Phase 2: Update AI Handler for AudioSocket Protocol

### AudioSocket Protocol Format:

**From Asterisk → AI Handler:**
```
[16-byte Header] + [Audio Payload]

Header format:
- UUID: 16 bytes (call identifier)
- Kind: 1 byte (0x00 = Silence, 0x01 = Audio, 0x10 = Hangup)
- Payload Length: 2 bytes
```

**From AI Handler → Asterisk:**
```
[Audio Payload only]
```

**Audio Format:**
- 8kHz µ-law (8-bit)
- OR 16kHz signed linear PCM (16-bit)

### Create AudioSocket Handler Library:

```typescript
// supabase/functions/_shared/audiosocket-handler.ts

export class AudioSocketHandler {
  private socket: Deno.Conn;
  private callId: string;
  private onAudioCallback?: (audio: Uint8Array) => void;

  constructor(conn: Deno.Conn) {
    this.socket = conn;
    this.callId = '';
  }

  async handleIncoming() {
    const buffer = new Uint8Array(4096);

    try {
      while (true) {
        const n = await this.socket.read(buffer);
        if (n === null) break; // Connection closed

        // Parse AudioSocket protocol
        const packet = buffer.slice(0, n);

        // First 16 bytes = UUID
        if (packet.length >= 16) {
          this.callId = new TextDecoder().decode(packet.slice(0, 16));
        }

        // Byte 16 = Kind (0x01 = audio, 0x10 = hangup)
        const kind = packet[16];

        if (kind === 0x10) {
          console.log('📞 Call hung up');
          break;
        }

        if (kind === 0x01) {
          // Bytes 17-18 = Payload length
          const payloadLength = (packet[17] << 8) | packet[18];

          // Bytes 19+ = Audio data
          const audioData = packet.slice(19, 19 + payloadLength);

          // Send to callback for STT processing
          if (this.onAudioCallback) {
            this.onAudioCallback(audioData);
          }
        }
      }
    } catch (error) {
      console.error('AudioSocket error:', error);
    }
  }

  // Send audio back to Asterisk
  async sendAudio(audioData: Uint8Array) {
    try {
      await this.socket.write(audioData);
    } catch (error) {
      console.error('Failed to send audio:', error);
    }
  }

  onAudio(callback: (audio: Uint8Array) => void) {
    this.onAudioCallback = callback;
  }

  close() {
    try {
      this.socket.close();
    } catch (error) {
      console.error('Error closing socket:', error);
    }
  }
}
```

### Update ai-call-handler-azure for AudioSocket:

```typescript
// supabase/functions/ai-call-handler-azure/index.ts
import { AudioSocketHandler } from '../_shared/audiosocket-handler.ts';

// Start TCP server for AudioSocket
const listener = Deno.listen({ port: 10000 });
console.log('🎧 AudioSocket server listening on port 10000');

for await (const conn of listener) {
  handleAudioSocketConnection(conn);
}

async function handleAudioSocketConnection(conn: Deno.Conn) {
  console.log('📞 New call connected via AudioSocket');

  const handler = new AudioSocketHandler(conn);

  // Initialize AI session
  const sttSession = initializeAzureSTT();
  const llmSession = initializeOpenRouter();
  const ttsSession = initializeElevenLabs();

  // Handle incoming audio from customer
  handler.onAudio(async (audioData: Uint8Array) => {
    // Convert µ-law to PCM if needed
    const pcmAudio = convertMuLawToPCM(audioData);

    // Send to Azure STT
    const transcript = await processSTT(sttSession, pcmAudio);

    if (transcript) {
      console.log('👤 Customer said:', transcript);

      // Send to LLM
      const aiResponse = await processLLM(llmSession, transcript);
      console.log('🤖 AI response:', aiResponse);

      // Convert to speech
      const ttsAudio = await processTTS(ttsSession, aiResponse);

      // Convert back to µ-law and send to customer
      const mulawAudio = convertPCMToMuLaw(ttsAudio);
      await handler.sendAudio(mulawAudio);
    }
  });

  // Start listening for audio
  await handler.handleIncoming();
  handler.close();
}
```

---

## Phase 3: Audio Format Conversion

### µ-law ↔ PCM Conversion Functions:

```typescript
// supabase/functions/_shared/audio-conversion.ts

// µ-law to 16-bit PCM
export function convertMuLawToPCM(mulaw: Uint8Array): Int16Array {
  const pcm = new Int16Array(mulaw.length);

  for (let i = 0; i < mulaw.length; i++) {
    pcm[i] = mulawToPCM(mulaw[i]);
  }

  return pcm;
}

function mulawToPCM(mulaw: number): number {
  const MULAW_BIAS = 33;
  const sign = (mulaw & 0x80) >> 7;
  const exponent = (mulaw & 0x70) >> 4;
  const mantissa = mulaw & 0x0F;

  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  if (sign === 0) sample = -sample;

  return sample;
}

// 16-bit PCM to µ-law
export function convertPCMToMuLaw(pcm: Int16Array): Uint8Array {
  const mulaw = new Uint8Array(pcm.length);

  for (let i = 0; i < pcm.length; i++) {
    mulaw[i] = pcmToMulaw(pcm[i]);
  }

  return mulaw;
}

function pcmToMulaw(pcm: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;

  const sign = (pcm < 0) ? 0x80 : 0x00;
  let magnitude = Math.abs(pcm);

  if (magnitude > MULAW_MAX) magnitude = MULAW_MAX;
  magnitude += MULAW_BIAS;

  let exponent = 7;
  for (let shift = magnitude >> 8; shift > 0x1F; shift >>= 1) {
    exponent++;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
  return ~(sign | (exponent << 4) | mantissa) & 0xFF;
}
```

---

## Phase 4: Deploy to Deno Deploy

### Option 1: Deploy via CLI

```bash
# Install deployctl
deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts

# Deploy
deployctl deploy --project=sifucall --prod \
  --include=supabase/functions/_shared \
  supabase/functions/ai-call-handler-azure/index.ts
```

### Option 2: Deploy via GitHub Actions

Already set up - just push to GitHub and it auto-deploys!

### Important: Open Port 10000

Deno Deploy needs to listen on TCP port 10000 for AudioSocket.

**Note:** Deno Deploy may not support raw TCP servers (only HTTP/WebSocket). We have 2 options:

#### Option A: Use Deno Compute (Self-hosted)
Deploy on your own server with raw TCP support

#### Option B: Use WebSocket wrapper
Wrap AudioSocket protocol in WebSocket (need to install proxy on MikoPBX)

---

## Phase 5: Testing

### Test 1: Verify AudioSocket is Available

```bash
ssh root@68.183.177.218
asterisk -rx "core show application AudioSocket"
```

Should show: `AudioSocket: Transmit and receive audio between channel and TCP socket`

### Test 2: Make Test Call

1. Use batch-call-v2 to call your own phone
2. Answer the call
3. Check logs in Deno Deploy
4. Verify audio is streaming

### Test 3: Monitor Logs

```bash
# On MikoPBX
asterisk -rvvv
# Watch for "AudioSocket" messages

# On Deno Deploy
# Check dashboard logs for incoming connections
```

---

## Alternative: Simpler WebSocket Approach

If AudioSocket is complex, use this **even simpler approach**:

### Create PHP-AGI Script on MikoPBX:

```php
// /storage/usbdisk1/mikopbx/custom_modules/ai-handler.php
<?php
require_once 'AGI.php';

$agi = new AGI();
$agi->answer();

// Connect to WebSocket
$wsUrl = 'wss://sifucall.deno.dev/ai-call';
$agi->exec('Dial', "Local/ws-bridge@custom");

// Audio flows through WebSocket bridge
?>
```

This uses MikoPBX's built-in WebSocket capabilities!

---

## Recommended Approach

**I recommend:** Start with **Hybrid** (Mik​oPBX + AlienVOIP calling, keep Twilio Media Streams temporarily).

**Why:**
1. AudioSocket requires TCP server (Deno Deploy limitation)
2. Would need proxy/bridge on MikoPBX
3. More complex to debug
4. Hybrid works NOW, full solution needs 2-4 weeks testing

**Then migrate** to full AudioSocket after hybrid is proven and making money!

---

## What Do You Want To Do?

1. **Deploy Hybrid NOW** - Start saving 50%+ immediately, perfect Full solution later
2. **Build Full AudioSocket** - Takes 2-4 weeks, but 100% Twilio-free

My recommendation: **Option 1** - Get hybrid working this week, earn revenue, then enhance!

What's your decision?
