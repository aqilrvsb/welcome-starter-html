# SIP/AlienVOIP Migration Guide

## Overview
This guide explains how to migrate from Twilio to AlienVOIP SIP trunk using MikoPBX on Digital Ocean.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│  Frontend   │─────>│ Deno Deploy  │─────>│   MikoPBX    │─────>│ AlienVOIP   │
│ (Batch Call)│      │(batch-call-v2)│      │(Digital Ocean)│      │ SIP Trunk   │
└─────────────┘      └──────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    │ (WebSocket)
                                                    ▼
                                            ┌──────────────┐
                                            │   AI Handler │
                                            │(Deno Deploy) │
                                            └──────────────┘
```

## What's Changed

### 1. Database Schema ✅ COMPLETED
- **File**: `supabase/migrations/20251022000000_add_sip_and_mikopbx_config.sql`
- Added `provider_type` field ('twilio' or 'sip')
- Added MikoPBX configuration fields
- Added SIP trunk configuration fields
- Made Twilio fields optional

### 2. TypeScript Types ✅ COMPLETED
- **File**: `src/integrations/supabase/types.ts`
- Updated `phone_config` interface with all new SIP fields

### 3. Frontend Configuration Form ✅ COMPLETED
- **File**: `src/components/settings/PhoneConfigForm.tsx`
- Added provider selector (Twilio vs SIP)
- Added MikoPBX server configuration section
- Added SIP trunk credentials section
- Supports AlienVOIP configuration out of the box

## User Configuration Example

Each user will configure their AlienVOIP account like this:

### MikoPBX Server (Shared)
```
MikoPBX URL: https://your-mikopbx.digitalocean.com
AMI Username: admin
AMI Password: your_ami_password
```

### SIP Trunk (Per User)
```
SIP Proxy Primary: sip1.alienvoip.com
SIP Proxy Secondary: sip3.alienvoip.com
SIP Username: 646006395  (unique per user)
SIP Password: Xh7Yk5Ydcg  (unique per user)
Codec: ulaw / G.729 / GSM
Caller ID: +60123456789
Display Name: My Company
```

## Next Steps

### 1. Apply Database Migration
```bash
# Push migration to Supabase
npx supabase db push
```

### 2. Setup MikoPBX on Digital Ocean

#### a. Install MikoPBX
- Deploy MikoPBX on Digital Ocean droplet
- Access web interface
- Complete initial setup wizard

#### b. Configure AlienVOIP SIP Trunk
Go to: **Connectivity → Providers → Add Provider**

```
Provider Type: SIP
Provider Name: AlienVOIP
Host: sip1.alienvoip.com
Username: 646006395
Password: Xh7Yk5Ydcg
Port: 5060
Transport: UDP
Codecs: ulaw, G.729, GSM
```

Backup Server:
```
Host: sip3.alienvoip.com
```

#### c. Create Outbound Route
Go to: **Routing → Outbound Routes → Add Route**

```
Route Name: AlienVOIP Outbound
Provider: AlienVOIP
Dial Pattern: X. (all numbers)
```

#### d. Enable AMI (Asterisk Manager Interface)
Go to: **System → Advanced → Asterisk Manager**

```
Enabled: Yes
Username: admin
Password: (set strong password)
Permit: 0.0.0.0/0.0.0.0 (or restrict to Deno Deploy IPs)
```

#### e. Create Custom Dialplan for WebSocket Calls
File: `/etc/asterisk/extensions_custom.conf`

```asterisk
[websocket-ai-handler]
; This context handles outgoing calls through AI handler
exten => _X.,1,NoOp(Starting AI call to ${EXTEN})
same => n,Set(CHANNEL(language)=en)
same => n,Answer()
same => n,Set(WEBSOCKET_URL=${ARG1})
same => n,Set(USER_ID=${ARG2})
same => n,Set(CAMPAIGN_ID=${ARG3})
same => n,Set(PROMPT_ID=${ARG4})
same => n,Set(CUSTOMER_NAME=${ARG5})
; Connect to WebSocket AI handler
same => n,Stasis(ai-call-handler,${WEBSOCKET_URL},${USER_ID},${CAMPAIGN_ID},${PROMPT_ID},${EXTEN},${CUSTOMER_NAME})
same => n,Hangup()
```

### 3. Create MikoPBX API Integration

**File to create**: `supabase/functions/_shared/mikopbx-client.ts`

```typescript
// MikoPBX API Client
export class MikoPBXClient {
  constructor(
    private url: string,
    private username: string,
    private password: string
  ) {}

  async originateCall(params: {
    phoneNumber: string;
    websocketUrl: string;
    userId: string;
    campaignId: string;
    promptId: string;
    customerName?: string;
  }) {
    // Use AMI to originate call
    // Implementation needed
  }
}
```

### 4. Update batch-call-v2 Function

**File**: `supabase/functions/batch-call-v2/index.ts`

Replace Twilio API calls with MikoPBX AMI calls when `provider_type === 'sip'`

### 5. Configure Asterisk for WebSocket

The AI handler needs to receive audio from Asterisk via WebSocket.

Options:
- **Option A**: Use AudioSocket (Asterisk 16+)
- **Option B**: Use ARI (Asterisk REST Interface) + Stasis
- **Option C**: Custom AGI script

## Cost Comparison

### Twilio
- Outgoing call: ~$0.02/min
- Incoming call: ~$0.01/min
- **Total**: ~$0.03/min

### AlienVOIP + MikoPBX
- AlienVOIP SIP: ~$0.005-0.01/min
- MikoPBX server: $12/month (Digital Ocean)
- **Total**: ~$0.006-0.01/min + fixed $12/month

**Savings**: ~66-80% cheaper!

## Testing Checklist

- [ ] Database migration applied
- [ ] Frontend form shows SIP configuration
- [ ] User can save AlienVOIP credentials
- [ ] MikoPBX is configured with AlienVOIP
- [ ] AMI is enabled and accessible
- [ ] Outbound route works (test manual call)
- [ ] WebSocket connection to AI handler works
- [ ] Batch call initiates calls via MikoPBX
- [ ] Audio flows correctly (both directions)
- [ ] Call logs are created properly
- [ ] Credits are deducted correctly

## Troubleshooting

### Common Issues

1. **"Failed to connect to MikoPBX"**
   - Check MikoPBX URL is accessible
   - Verify AMI credentials
   - Check firewall rules

2. **"SIP registration failed"**
   - Verify AlienVOIP credentials
   - Check SIP proxy addresses
   - Review MikoPBX SIP provider logs

3. **"No audio in calls"**
   - Check codec compatibility
   - Verify WebSocket connection
   - Review Asterisk audio logs

4. **"Calls not initiated"**
   - Check outbound route configuration
   - Verify dial pattern matches
   - Review AMI originate command

## Support

For issues, check:
- MikoPBX logs: `/var/log/asterisk/messages`
- Asterisk CLI: `asterisk -rvvv`
- AMI events: Enable AMI debugging

## Next Implementation Steps

1. Apply the database migration
2. Set up MikoPBX on Digital Ocean
3. Configure AlienVOIP SIP trunk in MikoPBX
4. Create the MikoPBX API client
5. Update batch-call-v2 to support SIP calls
6. Test end-to-end flow
