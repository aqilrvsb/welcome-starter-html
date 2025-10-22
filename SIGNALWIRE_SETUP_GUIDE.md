# SignalWire + AlienVoIP Setup Guide

Complete guide to migrate from Twilio to SignalWire with AlienVoIP SIP trunk integration.

---

## 💰 Cost Savings

**Monthly savings (400,000 minutes):**
- Current (Twilio): $5,200/month for calls
- New (SignalWire + AlienVoIP): $3,200/month for calls
- **Save: $2,000/month ($24,000/year)** 🎉

---

## 📋 Step 1: Complete SignalWire SIP Gateway Configuration

You've already started this! Here's how to complete it:

### A) Configuration Tab Settings

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `AlienVoIP Malaysia` | Friendly name |
| **URI** | Leave empty | Not needed |
| **External URI** | `sip:sip1.alienvoip.com` | Primary AlienVoIP server |
| **Encryption** | `optional` | ✅ Already set correctly |
| **Codecs** | Select only: | Remove encryption codecs |
| | ✅ `PCMU` (ulaw) | Supported by AlienVoIP |
| | ✅ `G729` | Supported by AlienVoIP |
| | ✅ `PCMA` (alaw) | Optional fallback |
| | ❌ Remove AES/encryption codecs | Those are for SRTP |

### B) Addresses & Phone Numbers Tab

Click on **"Addresses & Phone Numbers"** tab and add:

#### Primary Server:
```
Address:    sip1.alienvoip.com:5060
Transport:  UDP
Username:   646006395
Password:   Xh7Yk5Ydcg
```

#### Backup Server (optional but recommended):
```
Address:    sip3.alienvoip.com:5060
Transport:  UDP
Username:   646006395
Password:   Xh7Yk5Ydcg
```

Click **Save** when done.

---

## 🔑 Step 2: Get SignalWire API Credentials

1. In SignalWire dashboard, go to **"API"** → **"Credentials"**
2. Copy these 3 values:

```
Project ID:   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Auth Token:   PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Space URL:    yourspace.signalwire.com
```

**Keep these safe!** You'll need them in Step 5.

---

## 📱 Step 3: Buy a SignalWire Phone Number

1. Go to **"Phone Numbers"** → **"Buy a Number"**
2. Select country: **Malaysia** (for local numbers) or **United States** (for international)
3. Choose a number
4. Click **Buy** (cost: ~$0.50-$1.00/month)
5. Copy the phone number in E.164 format: `+60XXXXXXXXX` or `+1XXXXXXXXXX`

---

## 🗄️ Step 4: Apply Database Migration

Run this migration to add SignalWire fields to your database:

```bash
# In your project directory
supabase migration up
```

Or manually run the SQL from: `supabase/migrations/20251016000000_add_signalwire_config.sql`

This adds these fields to `phone_config` table:
- `provider_type` (twilio or signalwire)
- `signalwire_project_id`
- `signalwire_auth_token`
- `signalwire_space_url`
- `signalwire_phone_number`

---

## ⚙️ Step 5: Update Your Configuration

### Option A: Via Frontend Settings Page (Coming Soon)

I'll create a form where you can enter:
- Provider Type: Twilio or SignalWire
- SignalWire Project ID
- SignalWire Auth Token
- SignalWire Space URL
- SignalWire Phone Number

### Option B: Direct Database Update (Temporary)

Until the frontend form is ready, insert directly:

```sql
INSERT INTO phone_config (
  user_id,
  provider_type,
  signalwire_project_id,
  signalwire_auth_token,
  signalwire_space_url,
  signalwire_phone_number,
  -- Keep your existing Twilio fields for fallback
  twilio_account_sid,
  twilio_auth_token,
  twilio_phone_number
) VALUES (
  'YOUR_USER_ID',
  'signalwire',
  'YOUR_PROJECT_ID_FROM_STEP_2',
  'YOUR_AUTH_TOKEN_FROM_STEP_2',
  'yourspace.signalwire.com',
  '+60XXXXXXXXX',
  -- Your existing Twilio values
  'YOUR_TWILIO_SID',
  'YOUR_TWILIO_TOKEN',
  '+1XXXXXXXXX'
);
```

---

## 🔧 Step 6: Update batch-call-v2 Function

The `batch-call-v2` Edge Function needs to be updated to support SignalWire.

### Current code (Twilio):
```typescript
const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
const auth = btoa(`${accountSid}:${authToken}`);

const response = await fetch(twilioUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    To: phoneNumber,
    From: twilioPhoneNumber,
    Url: websocketUrl
  })
});
```

### New code (supports both):
```typescript
// Fetch phone config with provider_type
const { data: phoneConfig } = await supabaseClient
  .from('phone_config')
  .select('*')
  .eq('user_id', userId)
  .single();

let callUrl, auth, fromNumber;

if (phoneConfig.provider_type === 'signalwire') {
  // SignalWire API (Twilio-compatible)
  callUrl = `https://${phoneConfig.signalwire_space_url}/api/laml/2010-04-01/Accounts/${phoneConfig.signalwire_project_id}/Calls.json`;
  auth = btoa(`${phoneConfig.signalwire_project_id}:${phoneConfig.signalwire_auth_token}`);
  fromNumber = phoneConfig.signalwire_phone_number;
} else {
  // Twilio API (fallback)
  callUrl = `https://api.twilio.com/2010-04-01/Accounts/${phoneConfig.twilio_account_sid}/Calls.json`;
  auth = btoa(`${phoneConfig.twilio_account_sid}:${phoneConfig.twilio_auth_token}`);
  fromNumber = phoneConfig.twilio_phone_number;
}

const response = await fetch(callUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    To: phoneNumber,
    From: fromNumber,
    Url: websocketUrl
  })
});
```

---

## 🎤 Step 7: Verify WebSocket Handler Compatibility

Good news! Your `ai-call-handler-azure` function should work **as-is** because:
- SignalWire uses the same WebSocket Media Stream format as Twilio
- Audio encoding is identical (µ-law, 8kHz)
- Message format is compatible

**No changes needed!** ✅

---

## 🧪 Step 8: Test Your Setup

### A) Test Call Flow

1. Update `provider_type` to `signalwire` in database
2. Create a test campaign with 1 phone number
3. Click "Start Campaign"
4. Monitor logs:
   - Check batch-call-v2 logs for SignalWire API response
   - Check ai-call-handler-azure logs for WebSocket connection
   - Verify call connects to your test phone

### B) Verify Call Quality

- Latency should be good (<300ms round-trip)
- Audio should be clear
- AI responses should be natural

### C) Check Costs

After test call, verify in call_logs:
- SignalWire cost should be ~$0.003-0.008/min
- Much cheaper than Twilio's $0.013/min

---

## 💵 Step 9: Update Cost Calculations

Update your cost tracking to reflect new rates:

### In `ai-call-handler-azure` or cost calculation function:

```typescript
const COST_PER_MINUTE = {
  twilio: 0.013,
  signalwire_sip: 0.003,    // When using SIP trunk
  signalwire_pstn: 0.008,    // When using SignalWire direct
};

// Use based on provider_type
const callCostPerMin = provider_type === 'signalwire'
  ? COST_PER_MINUTE.signalwire_sip
  : COST_PER_MINUTE.twilio;
```

---

## 🚀 Step 10: Deploy

### A) Deploy Database Migration
```bash
supabase db push
```

### B) Deploy Updated Edge Function
```bash
supabase functions deploy batch-call-v2
```

### C) Deploy Frontend Changes (after UI update)
```bash
git push origin master
# Railway will auto-deploy
```

---

## 📊 Monitoring & Troubleshooting

### Check SignalWire Dashboard
- Go to **"Logs"** → **"Call Logs"**
- Verify calls are routing through AlienVoIP SIP trunk
- Check for any SIP errors

### Check AlienVoIP Balance
- Log in to AlienVoIP account
- Verify credits are being deducted
- Ensure balance is sufficient

### Common Issues

**Issue: "SIP Gateway not found"**
- Solution: Verify SIP Gateway is saved in SignalWire
- Check External URI format: `sip:sip1.alienvoip.com`

**Issue: "Authentication failed"**
- Solution: Verify Username (646006395) and Password in "Addresses & Phone Numbers" tab

**Issue: "Call connects but no audio"**
- Solution: Check codecs - use PCMU and G729 only

**Issue: "Higher latency than expected"**
- Solution: Verify AlienVoIP SIP server (sip1 is primary, sip3 is backup)

---

## 🔄 Rollback Plan

If anything goes wrong, you can instantly roll back:

### Option 1: Switch provider in database
```sql
UPDATE phone_config
SET provider_type = 'twilio'
WHERE user_id = 'YOUR_USER_ID';
```

### Option 2: Emergency fallback
The code supports both providers, so Twilio credentials remain in database as backup.

---

## 📈 Expected Results

After successful migration:

### Cost Comparison (400,000 mins/month):
| Component | Before (Twilio) | After (SignalWire) | Savings |
|-----------|-----------------|---------------------|---------|
| Call costs | $5,200 | $3,200 | $2,000 |
| Monthly profit | $37,600 | $39,600 | +$2,000 |
| Annual profit | $451,200 | $475,200 | +$24,000 |

### Performance:
- **Latency:** Similar or better than Twilio
- **Quality:** Same audio quality (8kHz µ-law)
- **Reliability:** 99.9% uptime (similar to Twilio)

---

## ✅ Checklist

- [ ] Complete SignalWire SIP Gateway configuration
- [ ] Get SignalWire API credentials (Project ID, Token, Space URL)
- [ ] Buy SignalWire phone number
- [ ] Apply database migration
- [ ] Update phone_config with SignalWire credentials
- [ ] Update batch-call-v2 function code
- [ ] Deploy Edge Function
- [ ] Test call with 1 phone number
- [ ] Verify call quality and costs
- [ ] Update cost calculations
- [ ] Monitor for 24 hours
- [ ] Scale to full production

---

## 🆘 Support

**SignalWire Support:**
- Docs: https://developer.signalwire.com
- Support: support@signalwire.com
- Community: https://signalwire.community

**AlienVoIP Support:**
- Website: https://alienvoip.com
- Support: Check your AlienVoIP account

**Your System:**
- Check logs: `supabase functions logs batch-call-v2`
- Check logs: `supabase functions logs ai-call-handler-azure`

---

## 🎉 Congratulations!

Once complete, you'll be saving **$24,000/year** with minimal effort!

Your profit margin improves from 47% to 49.5% 🚀
