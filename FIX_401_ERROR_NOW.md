# FIX 401 UNAUTHORIZED ERROR - ACTION PLAN

## THE PROBLEM

Your logs show:
```
❌ NetworkError: failed to connect to WebSocket: Invalid status code 401 Unauthorized
```

**401 Unauthorized = Your Azure subscription key is WRONG or INVALID**

Azure is rejecting your key. This means:
- Key is incorrect
- Key is expired
- Key was regenerated
- Key has spaces/quotes
- Key is not 32 characters

---

## STEP 1: Get the CORRECT Azure Key (5 minutes)

### 1. Go to Azure Portal
https://portal.azure.com

### 2. Find Your Speech Service
- In the search bar at top, type: **"Speech"**
- Click on your Speech Services resource
- If you don't see any Speech Services:
  - You need to CREATE one first!
  - Click "Create a resource" → Search "Speech" → Create Speech Service
  - Choose region: **Southeast Asia** (Singapore - fastest for Malaysia)

### 3. Get the Subscription Key
- Click **"Keys and Endpoint"** on the left menu
- You'll see:
  - **KEY 1** ← Copy this one!
  - KEY 2
  - Endpoint
  - Location/Region

### 4. Copy KEY 1 EXACTLY
- Click the copy icon next to KEY 1
- Should be **exactly 32 characters**
- Looks like: `a1b2c3d4e5f6789012345678901234ab`
- **NO spaces before or after**
- **NO quotes**

### 5. Also note your Region
- Should show: `southeastasia` or `eastasia`
- **NOT** "Southeast Asia" (no spaces, lowercase)

---

## STEP 2: Update Supabase Secrets (2 minutes)

### 1. Go to Supabase
https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

### 2. Update AZURE_SPEECH_KEY
- Find `AZURE_SPEECH_KEY` in the list
- Click **Edit** (pencil icon)
- **DELETE the old value completely**
- **Paste** the new KEY 1 from Azure Portal
- **IMPORTANT:** Make sure no spaces before/after
- Click **Save**

### 3. Verify AZURE_SPEECH_REGION
- Should be: `southeastasia` (lowercase, no spaces)
- If wrong, click Edit and change it
- Click **Save**

### 4. Verify Other Keys
Make sure these exist:
- ✅ `AZURE_SPEECH_KEY` - 32 characters, from Azure Portal KEY 1
- ✅ `AZURE_SPEECH_REGION` - `southeastasia`
- ✅ `OPENROUTER_API_KEY` - starts with `sk-or-v1-`
- ✅ `ELEVENLABS_API_KEY` - starts with `sk_`

---

## STEP 3: Deploy Updated Function (1 minute)

```bash
# Deploy with validation
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

Expected output:
```
✓ Deployed Function ai-call-handler-azure on project ahexnoaazbveiyhplfrc
```

---

## STEP 4: Watch Logs (Keep Running)

```bash
supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
```

---

## STEP 5: Make Test Call

1. Go to your app
2. Create campaign with your phone number
3. Start campaign
4. Answer call

---

## STEP 6: Check Logs for Validation

### ✅ SUCCESS - You'll see:
```
🔌 Connecting to Azure Speech WebSocket (region: southeastasia)...
✅ Subscription key validated: 32 characters
🔑 Key starts with: a1b2c3d4...
🔑 Key ends with: ...1234
✅ Azure Speech WebSocket connected successfully!
✅ Sent Azure Speech configuration with authentication
```

### ❌ FAILURE - Key Wrong Length:
```
❌ AZURE_SPEECH_KEY has wrong length: 35 characters (should be 32)
❌ Key value: a1b2c3d4...1234
❌ Please verify you copied KEY 1 from Azure Portal
```

**Fix:** You copied the wrong thing from Azure Portal. Go back and copy KEY 1 exactly.

### ❌ FAILURE - Still 401 Unauthorized:
```
❌ NetworkError: 401 Unauthorized
```

**Causes:**
1. **Key is old/expired** - Regenerate KEY 1 in Azure Portal
2. **Copied KEY 2 instead of KEY 1** - Copy KEY 1
3. **Speech Service is disabled** - Check Azure Portal
4. **Wrong subscription** - Check you're in correct Azure subscription

---

## Common Mistakes

### ❌ Mistake 1: Copied Endpoint Instead of Key
```
WRONG: https://southeastasia.api.cognitive.microsoft.com/
RIGHT: a1b2c3d4e5f6789012345678901234ab (32 chars)
```

### ❌ Mistake 2: Copied with Quotes
```
WRONG: "a1b2c3d4e5f6789012345678901234ab"
RIGHT: a1b2c3d4e5f6789012345678901234ab
```

### ❌ Mistake 3: Added Spaces
```
WRONG:  a1b2c3d4e5f6789012345678901234ab
RIGHT: a1b2c3d4e5f6789012345678901234ab
```

### ❌ Mistake 4: Used KEY 2
```
WRONG: Copy KEY 2
RIGHT: Copy KEY 1 ✅
```

### ❌ Mistake 5: Wrong Region Format
```
WRONG: Southeast Asia
WRONG: southeast-asia
WRONG: SouthEastAsia
RIGHT: southeastasia ✅
```

---

## Verify Your Azure Portal

### Check Speech Service Exists:
1. Go to: https://portal.azure.com
2. Click "All resources" on left menu
3. Search for "Speech"
4. You should see your Speech Service resource

### If No Speech Service Exists:

**You need to CREATE one!**

1. Click "+ Create a resource"
2. Search for "Speech"
3. Click "Speech" → "Create"
4. Fill in:
   - **Subscription:** Your Azure subscription
   - **Resource group:** Create new or select existing
   - **Region:** **Southeast Asia** ← Important for Malaysia!
   - **Name:** `my-speech-service` (or any name)
   - **Pricing tier:** **F0 (Free)** or **S0 (Standard)**
5. Click "Review + create"
6. Click "Create"
7. Wait 1-2 minutes for deployment
8. Click "Go to resource"
9. Click "Keys and Endpoint"
10. Copy **KEY 1**

---

## After Fixing Key - Expected Behavior

### What You'll See in Logs:
```
✅ Subscription key validated: 32 characters
🔑 Key starts with: 12345678...
✅ Azure Speech WebSocket connected successfully!
✅ Sent Azure Speech configuration with authentication
🎤 User said: Hello
🤖 Getting AI response from OpenRouter...
💬 AI Response: Hi there!
🎤 Using ElevenLabs voice: UcqZLa941Kkt8ZhEEybf
✅ Sent 20 audio chunks to Twilio
```

### What You'll Hear:
- ✅ Clear AI voice in Malay
- ✅ Natural conversation
- ✅ NO "heavy rain" sound
- ✅ NO silences
- ✅ ~1 second response time

---

## If Still Not Working After Correct Key

### Try Regenerating the Key:

1. Go to Azure Portal → Your Speech Service
2. Click "Keys and Endpoint"
3. Click **"Regenerate KEY 1"** button
4. Copy the new KEY 1
5. Update in Supabase secrets
6. Redeploy function
7. Test again

### Check Azure Service Health:

1. Go to: https://status.azure.com
2. Check if Azure Speech Services has any issues
3. Check your region (Southeast Asia)

### Check Azure Quota:

1. Azure Portal → Your Speech Service
2. Click "Metrics" on left menu
3. Check if you've exceeded quota
4. If free tier (F0): Limited to 5 hours/month
5. If exceeded: Upgrade to S0 (Standard tier)

---

## Summary Checklist

Before making the call:

- [ ] Verified Speech Service exists in Azure Portal
- [ ] Copied KEY 1 from "Keys and Endpoint" (32 characters)
- [ ] Updated `AZURE_SPEECH_KEY` in Supabase (no spaces, no quotes)
- [ ] Verified `AZURE_SPEECH_REGION` is `southeastasia`
- [ ] Deployed function: `supabase functions deploy ai-call-handler-azure`
- [ ] Logs running: `supabase functions logs ... --follow`

During deployment, logs show:

- [ ] "✅ Subscription key validated: 32 characters"
- [ ] "✅ Azure Speech WebSocket connected successfully!"
- [ ] NO "401 Unauthorized" errors

During call:

- [ ] Logs show "🎤 User said: ..."
- [ ] Logs show "💬 AI Response: ..."
- [ ] Logs show "🎤 Using ElevenLabs voice..."
- [ ] You hear clear AI voice (no heavy rain)

---

## DEPLOY NOW

```bash
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
```

Then make a test call and check the logs!

The new validation will tell you EXACTLY what's wrong with your key! 🔑
