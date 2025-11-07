# Fix Recording URL for Load Balancer Setup

## Problem:
When using load balancer (144.126.243.181), recordings are stored on individual servers but the URL points to the load balancer, which might route playback requests to the wrong server.

## Solution:
Detect which actual FreeSWITCH server handled the call and use that server's IP in the recording URL.

## Code Changes Needed:

In `supabase/functions/ai-call-handler-freeswitch/index.ts`, around line 545-586:

### BEFORE:
```typescript
const conn = await Deno.connect({
  hostname: FREESWITCH_HOST,
  port: FREESWITCH_ESL_PORT,
});

// Authenticate
await readESLResponse(conn);
await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
await readESLResponse(conn);

// ... more code ...

// Prepare recording filename (will be started when customer answers)
const recordingFilename = `${callId}_${Date.now()}.wav`;
const recordingPath = `/usr/local/freeswitch/recordings/${recordingFilename}`;
const recordingUrl = `https://${FREESWITCH_HOST}/recordings/${recordingFilename}`;
```

### AFTER:
```typescript
const conn = await Deno.connect({
  hostname: FREESWITCH_HOST,
  port: FREESWITCH_ESL_PORT,
});

// 🎯 DETECT ACTUAL SERVER: Get the real server IP we connected to
// When FREESWITCH_HOST is load balancer (144.126.243.181),
// this detects if we connected to 159.223.45.224 or 159.223.65.33
const actualServerIP = (conn.remoteAddr as Deno.NetAddr).hostname;
console.log(`🔍 Connected to FreeSWITCH: ${actualServerIP} (via ${FREESWITCH_HOST})`);

// Authenticate
await readESLResponse(conn);
await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
await readESLResponse(conn);

// ... more code ...

// Prepare recording filename (will be started when customer answers)
const recordingFilename = `${callId}_${Date.now()}.wav`;
const recordingPath = `/usr/local/freeswitch/recordings/${recordingFilename}`;
// ✅ Use the ACTUAL server IP, not load balancer IP
const recordingUrl = `https://${actualServerIP}/recordings/${recordingFilename}`;
```

## How It Works:

1. **FREESWITCH_HOST = 144.126.243.181** (Load Balancer)
2. Load balancer routes connection to either:
   - Server 1: 159.223.45.224
   - Server 2: 159.223.65.33
3. `conn.remoteAddr.hostname` gives us the **actual server** IP (159.223.45.224 or 159.223.65.33)
4. Recording URL saved in database: `https://159.223.45.224/recordings/abc123.wav`
5. Client can now playback recording from the correct server ✅

## Example:

**Call 1:**
- Load balancer routes to Server 1 (159.223.45.224)
- `actualServerIP = "159.223.45.224"`
- Recording URL: `https://159.223.45.224/recordings/call1.wav` ✅
- File is on Server 1 ✅

**Call 2:**
- Load balancer routes to Server 2 (159.223.65.33)
- `actualServerIP = "159.223.65.33"`
- Recording URL: `https://159.223.65.33/recordings/call2.wav` ✅
- File is on Server 2 ✅

## Client Code (No Changes Needed):

```typescript
// Client retrieves from Supabase
const { data } = await supabase
  .from('call_logs')
  .select('recording_url')
  .eq('call_id', callId)
  .single();

// Play recording - URL automatically points to correct server!
<audio src={data.recording_url} controls />
```

## Environment Variables:

```bash
# Set load balancer IP
FREESWITCH_HOST=144.126.243.181

# Code automatically detects actual server (159.223.45.224 or 159.223.65.33)
# and saves recording URL with actual server IP
```

## Benefits:

✅ No need for shared storage (saves $5/month)
✅ Recordings always playback from correct server
✅ Works with unlimited servers (just add more to load balancer)
✅ No code changes needed when scaling

## Apply the Changes:

Just update lines 549-552 and line 586 in `index.ts` with the code above!
