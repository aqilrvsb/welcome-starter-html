# FreeSWITCH (fspbx) + AlienVOIP Setup Guide
## Better Alternative to MikoPBX!

---

## Why FreeSWITCH is Better for AI Calls

| Feature | FreeSWITCH | MikoPBX |
|---------|-----------|---------|
| WebSocket Support | ✅ Native | ⚠️ Limited |
| Real-time Audio Streaming | ✅ mod_audio_fork | ❌ AudioSocket (not available) |
| Event Socket (ESL) | ✅ Built-in | ⚠️ AMI only |
| AI Integration Examples | ✅ Many | ❌ Few |
| WebRTC | ✅ Excellent | ⚠️ Basic |

**FreeSWITCH is designed for exactly what we're building!**

---

## Part 1: Install fspbx on Digital Ocean

### Requirements
- Debian 12/13
- 4GB RAM minimum
- 30GB storage
- Fresh droplet recommended

### One-Line Installation

```bash
wget -O- https://raw.githubusercontent.com/nemerald-voip/fspbx/main/install/install-fspbx.sh | bash
```

This installs:
- FreeSWITCH (PBX engine)
- fspbx web interface (Laravel + Vue.js)
- PostgreSQL database
- Nginx web server

**Installation takes ~15 minutes**

---

## Part 2: Access fspbx Web Interface

After installation:

1. Open browser: `http://YOUR_DROPLET_IP`
2. Default login will be shown in terminal after install
3. Change default password immediately!

---

## Part 3: Configure AlienVOIP SIP Trunk

### A. Create Gateway

1. Go to: **Accounts → Gateways**
2. Click **Add Gateway**
3. Settings:
   ```
   Gateway Name: AlienVOIP
   Username: 646006395
   Password: Xh7Yk5Ydcg
   Proxy: sip1.alienvoip.com
   Register: Yes
   Context: public
   Enabled: Yes
   ```
4. Click **Save**

### B. Configure Outbound Route

1. Go to: **Dialplan → Outbound Routes**
2. Create route for all outbound calls:
   ```
   Name: AlienVOIP Outbound
   Gateway: AlienVOIP
   Prefix: (empty for all numbers)
   Enabled: Yes
   ```
3. Save

---

## Part 4: Enable Event Socket Layer (ESL)

FreeSWITCH ESL is like AMI but better!

### Edit event_socket.conf.xml

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Edit ESL config
nano /etc/freeswitch/autoload_configs/event_socket.conf.xml
```

Change to:
```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="nat-map" value="false"/>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="8021"/>
    <param name="password" value="ClueCon"/>
  </settings>
</configuration>
```

Restart FreeSWITCH:
```bash
systemctl restart freeswitch
```

---

## Part 5: Enable mod_audio_fork (Real-time Audio Streaming)

This is THE feature we need for AI!

```bash
# Load module
fs_cli -x "load mod_audio_fork"

# Make it permanent
echo "load mod_audio_fork" >> /etc/freeswitch/autoload_configs/modules.conf.xml
```

**mod_audio_fork streams audio in real-time to WebSocket!**

---

## Part 6: Create Extension for AI Handler

1. Go to: **Accounts → Extensions**
2. Create Extension **999**:
   ```
   Extension: 999
   Effective Caller ID Name: AI Handler
   Effective Caller ID Number: 999
   Enabled: Yes
   ```
3. Save

---

## Part 7: Architecture

```
Customer Phone
    ↓
AlienVOIP SIP Trunk (sip1.alienvoip.com)
    ↓
FreeSWITCH Gateway (YOUR_DROPLET_IP)
    ↓
Extension 999
    ↓
mod_audio_fork → WebSocket Stream
    ↓
AI Handler (Deno Deploy)
    ↓
Azure STT → OpenRouter → ElevenLabs
    ↓
WebSocket Stream → mod_audio_fork
    ↓
Back to customer
```

---

## Part 8: Update batch-call-v2 for FreeSWITCH

We'll create FreeSWITCH ESL client (simpler than AMI):

### Create ESL Client

```typescript
// supabase/functions/_shared/freeswitch-esl-client.ts

export class FreeSwitchESLClient {
  private host: string;
  private port: number;
  private password: string;

  constructor(host = 'YOUR_DROPLET_IP', port = 8021, password = 'ClueCon') {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  async originateCall(phoneNumber: string, variables = {}) {
    const conn = await Deno.connect({
      hostname: this.host,
      port: this.port
    });

    // Authenticate
    await this.send(conn, `auth ${this.password}\n\n`);

    // Originate call with audio fork to WebSocket
    const cmd = `api originate {
      audio_fork_enable=true,
      audio_fork_url=wss://YOUR_DENO_DEPLOY_URL/audio,
      return_ring_ready=true
    }sofia/gateway/AlienVOIP/${phoneNumber} &bridge(user/999)\n\n`;

    await this.send(conn, cmd);

    conn.close();
  }

  private async send(conn: Deno.Conn, data: string) {
    const encoder = new TextEncoder();
    await conn.write(encoder.encode(data));

    // Read response
    const buffer = new Uint8Array(1024);
    await conn.read(buffer);
    return new TextDecoder().decode(buffer);
  }
}
```

---

## Part 9: Create AI Handler for mod_audio_fork

```typescript
// supabase/functions/ai-call-handler-freeswitch/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === '/audio' && req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log('🎤 FreeSWITCH audio stream connected!');
    };

    socket.onmessage = async (event) => {
      // Receive audio from FreeSWITCH (PCM 16-bit, 8kHz)
      const audioData = new Uint8Array(await event.data.arrayBuffer());

      console.log(`📥 Received ${audioData.length} bytes from FreeSWITCH`);

      // 1. Send to Azure STT
      const text = await transcribeAudio(audioData);
      console.log('💬 Customer said:', text);

      // 2. Send to OpenRouter GPT
      const aiResponse = await getAIResponse(text);
      console.log('🤖 AI responds:', aiResponse);

      // 3. Send to ElevenLabs TTS
      const responseAudio = await textToSpeech(aiResponse);

      // 4. Send audio back to FreeSWITCH
      socket.send(responseAudio);
      console.log('📤 Sent audio back to customer');
    };

    socket.onclose = () => {
      console.log('📞 Call ended');
    };

    return response;
  }

  return new Response('FreeSWITCH AI Handler', { status: 200 });
});

async function transcribeAudio(audio: Uint8Array): Promise<string> {
  // Azure STT implementation
  return "transcribed text";
}

async function getAIResponse(text: string): Promise<string> {
  // OpenRouter GPT implementation
  return "AI response";
}

async function textToSpeech(text: string): Promise<Uint8Array> {
  // ElevenLabs implementation
  return new Uint8Array();
}
```

---

## Part 10: Database Changes

Your database is already ready! It has:
- ✅ `mikopbx_url` → Change to `freeswitch_url`
- ✅ `sip_proxy_primary` → Use for AlienVOIP
- ✅ `sip_username` → AlienVOIP username
- ✅ `sip_password` → AlienVOIP password

Just update field name:

```sql
ALTER TABLE phone_config
RENAME COLUMN mikopbx_url TO freeswitch_url;
```

---

## Part 11: Advantages of FreeSWITCH for Your Use Case

### 1. Real-time Audio Streaming
- mod_audio_fork sends audio directly to WebSocket
- No proxy needed!
- No AudioSocket installation needed!

### 2. Better Event System
- ESL is simpler than AMI
- More events for call control
- Better documentation

### 3. WebRTC Built-in
- Native WebRTC support
- SIP over WebSocket
- Perfect for browser clients

### 4. AI Integration Examples
- Many open-source projects use FreeSWITCH for AI
- Google Dialogflow integration available
- Plenty of documentation

---

## Part 12: Cost Savings (Same as Before)

**AlienVOIP via FreeSWITCH:**
- RM0.008/min telephony
- Your own AI pipeline
- **Total: ~RM0.05/min**

**vs Twilio + VAPI:**
- RM0.53/min

**90% cheaper!** 🎉

---

## Next Steps

1. ✅ Install fspbx on fresh Digital Ocean droplet
2. ✅ Configure AlienVOIP gateway
3. ✅ Enable ESL on port 8021
4. ✅ Enable mod_audio_fork
5. ✅ Create Extension 999
6. ✅ Update database field names
7. ✅ Create FreeSWITCH ESL client
8. ✅ Deploy AI handler with audio streaming
9. ✅ Test with real call!

**FreeSWITCH is the RIGHT choice for AI call handling!** 🚀
