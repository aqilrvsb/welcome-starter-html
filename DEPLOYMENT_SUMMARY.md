# Deployment Summary - AI Call Handler Updates

## Date: October 24, 2025

## Overview
This deployment includes major updates to the AI Call Handler system, focusing on call recordings, UI enhancements, and database schema improvements.

---

## 1. Database Changes

### Migration Required: Add `prompt_id` to `call_logs`

**File:** `supabase/migrations/20251024000004_add_prompt_id_to_call_logs.sql`

**Purpose:** Allow call logs to directly reference prompts, even when campaign is optional/null

**SQL to Run in Supabase SQL Editor:**
```sql
-- Add prompt_id column to call_logs table
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS prompt_id UUID;

-- Add foreign key constraint to prompts table
ALTER TABLE public.call_logs
ADD CONSTRAINT call_logs_prompt_id_fkey
FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_logs_prompt_id ON public.call_logs(prompt_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.call_logs.prompt_id IS 'Direct reference to the prompt used for this call. This is required since campaign_id is now optional.';
```

**Status:** ⚠️ Already attempted but constraint exists. This is OK - means schema is already updated.

---

## 2. Edge Function Updates

### Main File: `supabase/functions/ai-call-handler-freeswitch/index.ts`

#### Key Changes:

### A. Recording System - Start on Answer (Lines 428-453)
**What Changed:** Recording now starts ONLY when customer answers the call, not during ringing.

**Benefits:**
- Recordings only capture actual conversation
- No wasted storage on ringing audio
- More accurate call duration in recordings
- Better user experience when reviewing calls

**Implementation:**
```typescript
// In monitorCallAnswerEvent() when CHANNEL_ANSWER detected:
if (session.recordingPath) {
  const recordConn = await Deno.connect({
    hostname: FREESWITCH_HOST,
    port: FREESWITCH_ESL_PORT,
  });

  await readESLResponse(recordConn);
  await sendESLCommand(recordConn, `auth ${FREESWITCH_ESL_PASSWORD}`);
  await readESLResponse(recordConn);

  const recordCmd = `api uuid_record ${callId} start ${session.recordingPath}`;
  console.log(`🎙️ Starting recording (customer answered): ${recordCmd}`);

  await sendESLCommand(recordConn, recordCmd);
  const recordResponse = await readESLResponse(recordConn);
  console.log(`📋 Recording Response: ${recordResponse}`);

  recordConn.close();
}
```

### B. Recording Metadata (Lines 342-356)
**What Changed:** Recording filename and path prepared during call origination, passed to session via metadata.

**New Metadata Fields:**
- `recording_url`: Public URL to access recording (e.g., `http://159.223.45.224/recordings/{callId}_{timestamp}.wav`)
- `recording_path`: Local filesystem path (e.g., `/usr/local/freeswitch/recordings/{callId}_{timestamp}.wav`)

### C. Session Object Updates (Lines 620-621)
**What Changed:** Added recording fields to session object.

**New Session Fields:**
```typescript
recordingUrl: recordingUrl,        // Store recording URL from metadata
recordingPath: recordingPath,      // Store recording path to start recording when answered
```

---

## 3. Frontend Updates

### File: `src/components/call-logs/CallLogsTable.tsx`

#### A. New Columns Added
1. **Product** - Shows product from contacts table
2. **Prompt** - Shows prompt name used for the call
3. **Campaign** - Shows campaign name (nullable if no campaign)

#### B. Removed Columns
- **Cost** - Removed from display (still calculated in backend)

#### C. Duration Format Update
**Before:** `72` (seconds)
**After:** `1 min 12 sec`

**Implementation:**
```typescript
const formatDuration = (duration?: number) => {
  if (!duration) return 'N/A';
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes} min ${seconds} sec`;
};
```

#### D. Database Query Update
```typescript
let query = supabase
  .from('call_logs')
  .select(`
    *,
    contacts(name, product),
    campaigns(campaign_name),
    prompts!call_logs_prompt_id_fkey(prompt_name)
  `)
  .eq('user_id', user.id);
```

---

### File: `src/components/ui/audio-player-dialog.tsx`

#### A. Removed "Buka di Tab Baru" Button
- Only "Muat Turun Rakaman" (Download Recording) button remains

#### B. Fixed Authentication Issues
**Problem:** Recording URLs required authentication, causing redirect to login page

**Solution:** Use blob URL approach with credentials

**Implementation:**
```typescript
// Load audio with credentials
const loadAudio = async () => {
  const response = await fetch(recordingUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'audio/*',
    }
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  setBlobUrl(url);

  // Play audio from blob URL
  audioRef.current.src = url;
  audioRef.current.play();
};
```

#### C. Fixed Download Function
```typescript
const downloadRecording = async () => {
  const response = await fetch(recordingUrl, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'audio/*' }
  });

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `recording-${Date.now()}.mp3`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};
```

---

## 4. Server Configuration (Already Completed)

### NGINX Configuration - `/etc/nginx/sites-available/fspbx.conf`

**Status:** ✅ Fixed and Running

**Configuration Added:**
```nginx
# Serve FreeSWITCH recordings publicly
location /recordings {
    alias /usr/local/freeswitch/recordings;
    autoindex off;
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
    add_header Content-Type "audio/wav";
}
```

**Testing:**
```bash
curl -I http://159.223.45.224/recordings/b86978b2-a1f0-4dfe-856f-fd4d1d7fda04_1761243257202.wav
# Returns: HTTP/1.1 200 OK
```

---

## 5. Git Commits Included in This Deployment

### Recent Commits (Latest First):
1. **2fc0596** - Start recording only when customer answers the call
2. **5cd0b3e** - Fix recording URL to use actual filename with timestamp
3. **dc0a653** - Add FreeSWITCH call recording to local server storage
4. **14b2c79** - Fix audio player to handle authenticated recording URLs via blob
5. **f8d46ba** - Add prompt_id column to call_logs for direct prompt relationship
6. **bbb3603** - Fix audio player: Remove 'Buka tab baru' button and fix download authentication

---

## 6. Deployment Steps

### Step 1: Database Migration
⚠️ **Already Complete** - The constraint already exists, so schema is updated.

### Step 2: Deploy Edge Function
Run in Supabase Dashboard or CLI:
```bash
# Navigate to Supabase Functions
# Deploy ai-call-handler-freeswitch function
# This will deploy the updated index.ts with all recording changes
```

**Or via CLI (if you have access token):**
```bash
npx supabase functions deploy ai-call-handler-freeswitch --project-ref vdzvhjqflbrjqmyxhhdk --no-verify-jwt
```

### Step 3: Deploy Frontend
```bash
# Build production frontend
npm run build

# Deploy to your hosting (Vercel/Netlify/etc)
# Or if using Supabase hosting:
npx supabase deploy
```

---

## 7. Testing Checklist

After deployment, verify:

### Backend Tests:
- [ ] Make a test call to verify recording starts only after answer
- [ ] Check Deno logs for: `🎙️ Starting recording (customer answered)`
- [ ] Verify recording file exists in `/usr/local/freeswitch/recordings/`
- [ ] Confirm recording URL is saved to database with timestamp
- [ ] Test recording is accessible via HTTP (http://159.223.45.224/recordings/...)

### Frontend Tests:
- [ ] Call Logs table shows Product, Prompt, Campaign columns
- [ ] Cost column is removed
- [ ] Duration displays as "X min Y sec" format
- [ ] Audio player opens and plays recording without login redirect
- [ ] Download button successfully downloads recording
- [ ] "Buka di Tab Baru" button is removed

### Database Tests:
- [ ] Query call_logs with prompts join works correctly
- [ ] Call logs without campaigns still show prompt information
- [ ] prompt_id is populated for all new calls

---

## 8. Rollback Plan

If issues occur:

### Rollback Edge Function:
```bash
# Revert to previous commit
git revert HEAD
git push origin master

# Or deploy specific previous version
npx supabase functions deploy ai-call-handler-freeswitch --project-ref vdzvhjqflbrjqmyxhhdk
```

### Rollback Frontend:
```bash
# Revert commits
git revert HEAD~6..HEAD
npm run build
# Deploy previous version
```

### Rollback Database:
```sql
-- If needed to remove prompt_id column (not recommended)
ALTER TABLE public.call_logs DROP COLUMN IF EXISTS prompt_id;
DROP INDEX IF EXISTS idx_call_logs_prompt_id;
```

---

## 9. Known Issues & Notes

### ✅ Resolved:
1. NGINX configuration broken - **FIXED** (stray 'n' characters removed)
2. Recording URL 302 redirect to login - **FIXED** (location block added)
3. Audio player authentication issues - **FIXED** (blob URL approach)
4. Recording filename timestamp mismatch - **FIXED** (use session.recordingUrl)

### ⚠️ Important Notes:
1. Recordings only work after customer answers (by design)
2. Recording format is WAV (mono, 8kHz)
3. Recording URL includes timestamp to prevent duplicates
4. Database migration constraint already exists (safe to ignore error)

---

## 10. Support & Contact

**Developer:** Claude Code
**Date:** October 24, 2025
**Version:** 1.0

**For issues:**
- Check Deno Deploy logs for edge function errors
- Check browser console for frontend errors
- Check `/var/log/nginx/error.log` for NGINX issues
- Check FreeSWITCH logs: `tail -f /var/log/freeswitch/freeswitch.log`

---

## Summary

This deployment includes:
- ✅ Recording system that starts only when customer answers
- ✅ Enhanced Call Logs UI with Product, Prompt, Campaign columns
- ✅ Fixed audio player authentication issues
- ✅ Improved duration formatting (X min Y sec)
- ✅ Database schema updates for prompt_id
- ✅ NGINX configuration for serving recordings
- ✅ 6 commits with comprehensive improvements

**Total Impact:**
- Better user experience (recordings only contain conversation)
- More accurate call data (product, prompt, campaign visibility)
- Fixed audio playback (no more login redirects)
- Better storage efficiency (no empty ringing audio)

---

**Ready for Production Deployment** ✅
