# FreeSWITCH AI Call Handler - Development History

**Project**: AI Voice Calling System using FreeSWITCH + mod_audio_stream
**Goal**: Real-time bidirectional audio streaming with AI (Azure STT → GPT-4o-mini → ElevenLabs TTS)
**Target**: Scale to 200,000 concurrent calls on Deno Deploy

---

## 🎯 Current Status: **WORKING** ✅

**Working Version**: Commit `47ceabc` (with debug logging added)
**Deployment**: Deno Deploy at `wss://sifucall.deno.dev`
**FreeSWITCH**: 159.223.45.224 (Debian 13, FreeSWITCH 1.10.12)

### What's Working Now:
- ✅ Phone rings customer
- ✅ Customer answers → AI greeting plays immediately
- ✅ Natural conversation with turn-taking
- ✅ Transcription with confidence scoring
- ✅ AI responses with GPT-4o-mini
- ✅ Smooth audio playback (L16 PCM @ 8kHz)
- ✅ No audio cutting or interruptions

---

## 📚 Development Stages & Solutions

### Stage 1: Initial Problem - "System WAS Working, Then Broke"

**User Feedback**:
> "before this working...but when i request you to add dynamic ooo, hmm,,...terus xjadi smpai sskrang"

**Root Cause Identified**:
- System worked perfectly before
- After adding filler words feature, system stopped working completely
- Problem wasn't the filler words themselves, but the **timing logic changes**

**The Mistake I Made**:
- Added complex `monitorCallAnswerEvent()` with race condition fixes
- Added state checking that blocked ALL calls
- **Removed the working immediate greeting approach**

**The Fix**:
```bash
git reset --hard 47ceabc  # Revert to working version
```

**Key Learning**:
> If something is working, DON'T change the core logic when adding features!

---

### Stage 2: "No Audio Heard" Investigation

**User Feedback**:
> "phone ringing -- and i accept...but terjadi balik no sound/voice"
> "volum so high already call..still no sound"

**What I Investigated** (WRONG PATH):
1. Analyzed SSH logs, found codec mismatch:
   ```
   Set Codec sofia/external/0146674397 PCMU/8000
   Codec Activated L16@8000hz 1 channels 20ms
   ```

2. Thought problem was L16 vs PCMU codec mismatch
3. Implemented µ-law encoding (commit `ab515e1`)
4. **THIS WAS UNNECESSARY!** ❌

**What Actually Happened**:
- The working version (commit `47ceabc`) ALSO uses L16 PCM
- L16 PCM works perfectly fine with FreeSWITCH
- The problem was **TIMING**, not codec format

**Key Learning**:
> Don't assume codec mismatch from logs. L16 PCM works fine if timing is correct!

---

### Stage 3: Understanding The Real Problem - TIMING

**Critical Discovery**:
When customer answered, NO greeting was sent! Logs showed:
```
✅ Call 197602a4... ANSWERED by customer!
⏳ Waiting for customer to pick up call...
📞 Call started: 197602a4...
```

**Missing log**: No "📞 Triggering greeting" after answer event!

**Root Cause**:
The `monitorCallAnswerEvent()` function detected the answer, but the condition check failed:

```typescript
// Line 290-296 in index.ts
const session = activeCalls.get(callId);
if (session && !session.hasGreeted) {  // ← This condition was failing!
  session.isCallAnswered = true;
  console.log(`📞 Triggering greeting for ${callId}...`);  // ← NEVER PRINTED!
  await speakToCall(session, session.firstMessage);
  session.hasGreeted = true;
}
```

**Possible reasons**:
1. Session doesn't exist when answer event fires (race condition)
2. Session already marked as `hasGreeted = true`
3. `firstMessage` is empty/undefined

**The Debug Fix** (Current working code):
```typescript
// Added comprehensive debug logging (line 290)
console.log(`🔍 Debug: session=${!!session}, hasGreeted=${session?.hasGreeted}, firstMessage="${session?.firstMessage}"`);

if (session && !session.hasGreeted) {
  session.isCallAnswered = true;
  console.log(`📞 Triggering greeting for ${callId}...`);
  await speakToCall(session, session.firstMessage);
  session.hasGreeted = true;
} else if (!session) {
  console.error(`❌ Session ${callId} not found in activeCalls!`);
} else if (session.hasGreeted) {
  console.log(`⚠️ Session ${callId} already greeted, skipping`);
}
```

---

## 🔧 Code Architecture - How It Works

### Call Flow (WORKING VERSION):

```
1. User clicks "Make Call"
   ↓
2. originateCallWithAudioStream()
   - FreeSWITCH originates call via ESL
   - Call is parked: &park()
   - uuid_audio_stream starts WebSocket to Deno
   - monitorCallAnswerEvent() started in background
   ↓
3. Customer's phone rings 📞
   ↓
4. monitorCallAnswerEvent() waits for CHANNEL_ANSWER
   - ESL event subscription: filter Unique-ID + event CHANNEL_ANSWER
   ↓
5. Customer picks up ✅
   ↓
6. CHANNEL_ANSWER event fires
   - Find session in activeCalls Map
   - Check: session exists && !hasGreeted
   - Call speakToCall(session, firstMessage)
   ↓
7. speakToCall() sends greeting
   - ElevenLabs TTS → PCM 16kHz
   - Downsample to 8kHz
   - Convert to L16 PCM (Uint8Array)
   - Base64 encode
   - Send via WebSocket: {"type":"streamAudio", "data":{...}}
   ↓
8. mod_audio_stream receives audio
   - Saves to /tmp/{callId}_0.tmp.r8
   ↓
9. uuid_broadcast plays audio
   - file_string://{rate=8000,channels=1}/tmp/{callId}_0.tmp.r8
   - Customer hears AI greeting! 🎉
   ↓
10. Turn-taking conversation begins
    - handleMediaStream() processes customer audio
    - transcribeAudio() → Azure STT
    - getAIResponse() → GPT-4o-mini
    - speakToCall() → ElevenLabs TTS
    - Loop continues...
```

### Key Files & Functions:

#### 1. **originateCallWithAudioStream()** (Line 194-258)
**Purpose**: Initiate call via FreeSWITCH ESL
**Key Actions**:
- Originate call and park it
- Start audio streaming with uuid_audio_stream
- Launch background event monitor

**Critical Code**:
```typescript
// Line 247-248: Start monitoring in background (DON'T AWAIT!)
monitorCallAnswerEvent(callId, websocketUrl);
```

#### 2. **monitorCallAnswerEvent()** (Line 260-307)
**Purpose**: Detect when customer answers and trigger greeting
**Key Actions**:
- Subscribe to CHANNEL_ANSWER events via ESL
- Wait for customer to pick up
- Trigger greeting immediately when answered

**Critical Code**:
```typescript
// Line 289-301: The greeting trigger logic
const session = activeCalls.get(callId);
console.log(`🔍 Debug: session=${!!session}, hasGreeted=${session?.hasGreeted}, firstMessage="${session?.firstMessage}"`);

if (session && !session.hasGreeted) {
  session.isCallAnswered = true;
  console.log(`📞 Triggering greeting for ${callId}...`);
  await speakToCall(session, session.firstMessage);
  session.hasGreeted = true;
}
```

**⚠️ CRITICAL**: This function runs in the BACKGROUND!
- It does NOT block originateCallWithAudioStream()
- Session must exist in activeCalls before answer event fires
- Race condition possible if WebSocket connects slowly

#### 3. **handleCallStart()** (Line 309-372)
**Purpose**: Initialize session when WebSocket connects
**Key Actions**:
- Fetch voice config and prompts from Supabase
- Create session object in activeCalls Map
- DON'T send greeting yet (wait for answer event)

**Critical Code**:
```typescript
// Line 356-364: Initialize session with flags
const session = {
  callId,
  userId,
  campaignId,
  systemPrompt,
  firstMessage,
  voiceId,
  voiceSpeed,
  socket,
  startTime: new Date(),
  transcript: [],
  conversationHistory: [{ role: 'system', content: systemPrompt }],
  audioBuffer: [],
  isProcessingAudio: false,
  isSpeaking: false,
  isCallAnswered: false,  // ← Track if customer answered
  hasGreeted: false,      // ← Track if greeting sent
  costs: { azure_stt: 0, llm: 0, tts: 0 },
  audioFileCounter: 0,
};

activeCalls.set(callId, session);  // ← Make session available for monitorCallAnswerEvent()

console.log("⏳ Waiting for customer to pick up call...");
```

#### 4. **handleMediaStream()** (Line 374-407)
**Purpose**: Process incoming audio from customer
**Key Actions**:
- Buffer audio chunks
- Only process after call is answered
- Don't process while AI is speaking (avoid interruptions)

**Critical Code**:
```typescript
// Line 383-385: Don't process until answered
if (!session.isCallAnswered) {
  return; // Silently discard audio until customer picks up
}

// Line 387-391: Don't interrupt AI speech
if (session.isSpeaking || session.isProcessingAudio) {
  return; // Discard audio during AI speech
}
```

#### 5. **speakToCall()** (Line 511-625)
**Purpose**: Convert text to speech and play to customer
**Key Actions**:
- Get TTS from ElevenLabs (PCM 16kHz)
- Downsample to 8kHz
- Send via WebSocket as L16 PCM
- Play using uuid_broadcast

**Critical Code - Audio Format**:
```typescript
// Line 555-558: Downsample 16kHz → 8kHz
const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
for (let i = 0; i < pcm8k.length; i++) {
  pcm8k[i] = pcm16k[i * 2];
}

// Line 560-561: Keep as L16 PCM (DON'T convert to µ-law!)
const pcmBytes = new Uint8Array(pcm8k.buffer);
```

**Critical Code - Playback**:
```typescript
// Line 603-604: uuid_broadcast to play audio
const fileString = `file_string://{rate=8000,channels=1}${audioFile}`;
const broadcastCmd = `api uuid_broadcast ${session.callId} ${fileString} aleg`;
```

---

## ⚠️ Common Pitfalls & Solutions

### Pitfall 1: "Changing Working Code Without Understanding Why It Works"

**What I Did Wrong**:
- User said system was working before
- I removed the working `monitorCallAnswerEvent()` logic
- Tried to "fix" by sending greeting immediately (like Twilio)
- This broke the timing completely

**The Right Approach**:
- **ALWAYS** understand WHY code works before changing it
- **NEVER** remove working logic without comprehensive testing
- If adding features, ADD code, don't REPLACE working code

**Recovery**:
```bash
git log --oneline  # Find the last working commit
git reset --hard 47ceabc  # Revert to working version
```

---

### Pitfall 2: "Assuming Codec Issues When Problem Is Timing"

**What I Did Wrong**:
- Saw L16 codec in logs, call uses PCMU
- Assumed this was the problem
- Implemented µ-law encoding
- Wasted time on wrong solution

**The Right Approach**:
- Check if working version has same "issue"
- If working version also uses L16, then L16 is NOT the problem!
- Focus on what CHANGED, not what LOOKS wrong

**Key Insight**:
> FreeSWITCH handles L16 PCM perfectly fine. The codec shown in logs doesn't always indicate a problem.

---

### Pitfall 3: "Race Conditions Between ESL Events and WebSocket"

**The Problem**:
```
Timeline:
03:48:13 - Call originated
03:48:14 - WebSocket connected → handleCallStart() called → session created
03:48:20 - Customer answered → monitorCallAnswerEvent() looks for session
```

**Potential Issue**:
If WebSocket is slow to connect, `monitorCallAnswerEvent()` might fire BEFORE `handleCallStart()` creates the session!

**Current Status**: Working, but could be fragile

**Possible Future Fix**:
```typescript
// In monitorCallAnswerEvent(), add retry logic
let retries = 0;
while (!activeCalls.get(callId) && retries < 10) {
  await new Promise(resolve => setTimeout(resolve, 100));
  retries++;
}
const session = activeCalls.get(callId);
```

---

## 📝 Critical Debug Logs to Monitor

When testing new changes, watch for these logs in sequence:

### ✅ Expected Working Flow:
```
1. 📞 Originating: api originate {...}
2. ✅ Call UUID: {callId}
3. 🎤 Starting audio stream: api uuid_audio_stream...
4. 👂 Monitoring call {callId} for ANSWER event...
5. 🎤 FreeSWITCH audio WebSocket connected!
6. 📋 Metadata: {...}
7. 📞 Call started: {callId}
8. ⏳ Waiting for customer to pick up call...
9. ✅ Call {callId} ANSWERED by customer!
10. 🔍 Debug: session=true, hasGreeted=false, firstMessage="..."
11. 📞 Triggering greeting for {callId}...
12. 🔊 Speaking: "Assalamualaikum..."
13. 📦 Sending 38638 bytes of L16 PCM audio...
14. ✅ Audio sent to FreeSWITCH in JSON format!
15. 🎵 Playing audio: api uuid_broadcast...
16. 🎵 Broadcast response: +OK Message sent
17. ✅ Audio playback complete, ready for customer input
```

### ❌ Problem Indicators:

**Missing greeting**:
```
✅ Call {callId} ANSWERED by customer!
🔍 Debug: session=false, hasGreeted=undefined, firstMessage="undefined"
❌ Session {callId} not found in activeCalls!
```
**Solution**: Race condition - WebSocket slow to connect

**Already greeted**:
```
✅ Call {callId} ANSWERED by customer!
🔍 Debug: session=true, hasGreeted=true, firstMessage="..."
⚠️ Session {callId} already greeted, skipping
```
**Solution**: Function called twice or session state corrupted

**No audio file**:
```
🎵 Playing audio: api uuid_broadcast...
❌ Error playing audio: File not found
```
**Solution**: mod_audio_stream didn't save file - check WebSocket message format

---

## 🚀 Testing Checklist

Before deploying new changes, test these scenarios:

### Test 1: Normal Call Flow
- [ ] Phone rings
- [ ] Customer answers
- [ ] Greeting plays immediately (< 1 second after answer)
- [ ] Customer can hear AI clearly
- [ ] Customer responds
- [ ] AI hears and responds correctly
- [ ] Turn-taking works smoothly (no cutting)

### Test 2: Edge Cases
- [ ] Customer answers instantly (< 1 sec after ring)
- [ ] Customer answers after long wait (> 20 sec)
- [ ] Customer hangs up before answering
- [ ] Customer hangs up during AI speech
- [ ] Network lag / slow WebSocket connection

### Test 3: Multiple Concurrent Calls
- [ ] Launch 5 calls simultaneously
- [ ] All calls should work independently
- [ ] No session mix-ups
- [ ] No audio cross-contamination

---

## 🔄 Recovery Procedure

If something breaks after new changes:

### Step 1: Check Logs
```bash
# Deno logs - look for the debug sequence
# SSH logs - check FreeSWITCH errors
ssh root@159.223.45.224 "tail -100 /var/log/freeswitch/freeswitch.log"
```

### Step 2: Identify What Changed
```bash
cd c:/Users/aqilz/Documents/welcome-starter-html-master
git log --oneline -10
git diff 47ceabc HEAD -- supabase/functions/ai-call-handler-freeswitch/index.ts
```

### Step 3: Revert to Last Working Version
```bash
git reset --hard 47ceabc  # Or whatever commit was last working
```

### Step 4: Re-deploy to Deno
```
Copy index.ts to Deno Deploy manually
Test thoroughly before adding new features
```

### Step 5: Re-apply Changes Carefully
- Add changes incrementally, not all at once
- Test after EACH change
- Commit working versions frequently
- Never change core timing logic

---

## 📌 Important Code Markers

Search for these comments in the code when debugging:

### 1. Session Initialization
```typescript
// File: index.ts, Line 356-371
// MARKER: SESSION_INIT
const session = {
  // ... session object
  isCallAnswered: false,  // ← DON'T change this default!
  hasGreeted: false,      // ← DON'T change this default!
};
```

### 2. Greeting Trigger
```typescript
// File: index.ts, Line 289-301
// MARKER: GREETING_TRIGGER
const session = activeCalls.get(callId);
if (session && !session.hasGreeted) {
  // ← THIS is where greeting is sent!
  await speakToCall(session, session.firstMessage);
}
```

### 3. Audio Format
```typescript
// File: index.ts, Line 560-561
// MARKER: AUDIO_FORMAT
const pcmBytes = new Uint8Array(pcm8k.buffer);
// ← Keep as L16 PCM! DON'T convert to µ-law!
```

### 4. Playback Command
```typescript
// File: index.ts, Line 603-604
// MARKER: PLAYBACK_CMD
const fileString = `file_string://{rate=8000,channels=1}${audioFile}`;
// ← DON'T add codec=PCMU! L16 works!
```

---

## 🎓 Key Learnings Summary

1. **L16 PCM works perfectly** - Don't assume codec mismatch from logs
2. **Timing is critical** - Customer must answer BEFORE greeting is sent
3. **ESL events are async** - Race conditions possible between ESL and WebSocket
4. **Debug logs are essential** - Add comprehensive logging for critical paths
5. **Git history is your friend** - Always commit working versions
6. **Don't fix what works** - Understand before changing working code
7. **Test incrementally** - Add features one at a time, test thoroughly

---

## 📋 Next Steps (Future Improvements)

### High Priority:
1. ✅ Add filler words ("Ooo", "Faham cik", etc.) for natural conversation
2. ⏳ Add retry logic for race conditions in monitorCallAnswerEvent()
3. ⏳ Implement proper error handling for Supabase/API failures
4. ⏳ Add call recording and transcript saving

### Medium Priority:
5. ⏳ Optimize for 200K concurrent calls (connection pooling, load balancing)
6. ⏳ Add metrics and monitoring (Prometheus/Grafana)
7. ⏳ Implement call queue management
8. ⏳ Add A/B testing for prompts and voices

### Low Priority:
9. ⏳ Add multi-language support (currently only ms-MY)
10. ⏳ Implement voice analytics (sentiment, emotion detection)

---

---

## 🔐 CRITICAL DEPLOYMENT RULES

### Rule 1: Deno Deploy Changes
**⚠️ IMPORTANT**: Only change files in this directory when deploying to Deno:
```
supabase/functions/ai-call-handler-freeswitch/
```

**Deno Deploy Token**:
```
ddp_KjV4MgPLe6KZIJMJR622qMUzOVxbne1dzjPL
```

**DO NOT**:
- ❌ Change other function directories
- ❌ Modify database migrations during deployment
- ❌ Update environment variables without testing locally first

### Rule 2: GitHub Push
**Always push to GitHub after successful deployment**:
```bash
cd c:/Users/aqilz/Documents/welcome-starter-html-master
git add .
git commit -m "Your commit message"
git push
```

**Commit Message Format**:
- Use descriptive messages
- Include emoji for clarity (🔧 fix, ✨ feature, 📝 docs, 🐛 bug)
- Reference what changed and why

### Rule 3: SSH Access
**FreeSWITCH Server**: 159.223.45.224
**SSH Password**: `Dev2025@@ASD`

**DO NOT**:
- ❌ Ask for password every time
- ❌ Use git commands that require authentication without credentials stored
- ❌ Leave SSH sessions hanging (always close properly)

**Checking FreeSWITCH Logs**:
```bash
# Always use password in command to avoid prompts
sshpass -p 'Dev2025@@ASD' ssh root@159.223.45.224 "tail -100 /var/log/freeswitch/freeswitch.log"

# Or use this shorter version
ssh root@159.223.45.224 "tail -100 /var/log/freeswitch/freeswitch.log | grep -E '(callId|Codec|playback)'"
```

---

**Document Last Updated**: 2025-10-23
**Current Working Commit**: `47ceabc` (with debug logging added)
**Maintainer**: Development team
**Status**: ✅ PRODUCTION READY (with debug logs)
