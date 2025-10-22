# MikoPBX Configuration - Credentials & Settings

**Date Configured:** 2025-10-22
**MikoPBX Server:** http://68.183.177.218
**Status:** ✅ Fully Configured and Ready

---

## 1. AlienVOIP SIP Trunk Configuration

### SIP Provider Details
| Setting | Value |
|---------|-------|
| Provider Name | AlienVOIP |
| Account Type | Outgoing Registration |
| Host/Proxy Primary | sip1.alienvoip.com |
| Outbound Proxy (Backup) | sip3.alienvoip.com |
| SIP Port | 5060 |
| Username | 646006395 |
| Password | Xh7Yk5Ydcg |
| DTMF Mode | rfc2833 |
| Transport Protocol | UDP, TCP |
| NAT Support | Enabled (60 seconds keepalive) |
| **Registration Status** | ✅ **GREEN** (Successfully Registered) |

---

## 2. Outbound Routing Configuration

### Route: AI Calls via AlienVOIP
| Setting | Value |
|---------|-------|
| Rule Name | AI Calls via AlienVOIP |
| Number Pattern | All numbers (universal match) |
| Provider | AlienVOIP |
| Status | ✅ Active |

**Function:** Routes all outbound calls through AlienVOIP SIP trunk

---

## 3. AI Handler Extension

### Extension 999 - AI Handler
| Setting | Value |
|---------|-------|
| Extension Number | 999 |
| Username | AI Handler |
| Account Type | SIP |
| Password | Dev2025@@ |
| DTMF Mode | rfc2833 |
| Transport Protocol | UDP, TCP |
| Network Filter | Allow from any addresses |
| Call Recording | Enabled |
| **Status** | ⚪ Offline (will be green when AI WebSocket connects) |

**Purpose:** This extension is the destination for AI conversations. When a customer answers, they get connected to this extension, which connects to your AI WebSocket handler.

---

## 4. AMI (Asterisk Manager Interface) Access

### AMI Account: batch-call-api
| Setting | Value |
|---------|-------|
| Username | batch-call-api |
| Password | Dev2025@@ |
| AMI Port | 5038 |
| Connection Type | Telnet / TCP Socket |
| Network Filter | Allow from any addresses |

### Permissions Granted:
**Read Permissions:**
- ✅ call (read call status)
- ✅ originate (read originate events)
- ✅ system (read system info)

**Write Permissions:**
- ✅ call (manage calls)
- ✅ originate (trigger outbound calls) ← **CRITICAL FOR BATCH CALLING**
- ✅ system (send system commands)

**Purpose:** Allows batch-call-v2 function to programmatically trigger calls via AMI Originate command

---

## 5. Connection Information Summary

### For Your batch-call-v2 Function:

**MikoPBX AMI Connection:**
```javascript
const MIKOPBX_CONFIG = {
  host: '68.183.177.218',
  port: 5038,
  username: 'batch-call-api',
  password: 'Dev2025@@',
};
```

**AI Handler Extension (for WebSocket):**
```javascript
const AI_EXTENSION_CONFIG = {
  extension: '999',
  username: 'AI Handler',
  password: 'Dev2025@@',
  server: '68.183.177.218',
};
```

**AlienVOIP SIP Trunk (already configured in MikoPBX):**
```javascript
const ALIENVOIP_CONFIG = {
  primary_proxy: 'sip1.alienvoip.com',
  secondary_proxy: 'sip3.alienvoip.com',
  port: 5060,
  username: '646006395',
  password: 'Xh7Yk5Ydcg',
  // No need to use directly - MikoPBX handles this
};
```

---

## 6. Call Flow Architecture

```
User Clicks "Start Batch Call"
         ↓
batch-call-v2 (Deno Deploy)
         ↓
MikoPBX AMI (68.183.177.218:5038)
  - Login: batch-call-api / Dev2025@@
  - Action: Originate
         ↓
AlienVOIP SIP Trunk (sip1.alienvoip.com)
  - Username: 646006395
  - Status: ✅ Registered
         ↓
PSTN / Customer Phone (e.g., 60123456789)
         ↓
Customer Answers
         ↓
Connected to Extension 999 (AI Handler)
         ↓
AI WebSocket Handler (Deno Deploy)
  - Registers as Extension 999
  - Password: Dev2025@@
         ↓
Azure OpenAI Real-time API
         ↓
Live AI Conversation with Customer
```

---

## 7. AMI Originate Command Example

### Connect via Telnet
```bash
telnet 68.183.177.218 5038
```

### Login
```
Action: Login
Username: batch-call-api
Secret: Dev2025@@
Events: off

```

### Originate Call Example
```
Action: Originate
Channel: Local/999@internal-originate
Context: all_peers
Exten: 60123456789
Priority: 1
Callerid: Company <60123456789>
Variable: pt1c_cid=60123456789
Async: true

```

**Explanation:**
- **Channel:** Start from extension 999 (AI Handler)
- **Exten:** Destination phone number (customer)
- **Context:** Routing context (all_peers)
- **Callerid:** What the customer sees
- **Async:** Return immediately (don't wait for call to complete)

---

## 8. Firewall & Network Configuration

### MikoPBX Firewall (Already Configured)
**Open Ports:**
- TCP 80, 443 (Web Interface)
- TCP 22 (SSH)
- TCP 5038 (AMI)
- TCP 5061 (SIP TLS)
- UDP 5060 (SIP)
- UDP 10000-10800 (RTP Audio)

**Allowed SIP Hosts:**
- 93.188.43.134 (Provider IP)
- 203.223.159.20 (Provider IP)

---

## 9. Testing Checklist

### Before Integrating with batch-call-v2:

- [x] ✅ AlienVOIP SIP trunk registered (green status)
- [x] ✅ Outbound routing configured
- [x] ✅ AI Handler extension created (999)
- [x] ✅ AMI account created with originate permissions
- [ ] ⏳ Test manual AMI connection via telnet
- [ ] ⏳ Test Originate command to make test call
- [ ] ⏳ Verify call goes through AlienVOIP
- [ ] ⏳ Verify audio quality and DTMF
- [ ] ⏳ Create MikoPBX AMI client library (Node.js)
- [ ] ⏳ Update batch-call-v2 to use MikoPBX
- [ ] ⏳ Integrate AI WebSocket handler with Extension 999
- [ ] ⏳ End-to-end test: Batch call → Customer phone → AI conversation

---

## 10. Next Steps

### Phase 1: Test AMI Connection (Manual)
1. SSH/telnet to MikoPBX: `telnet 68.183.177.218 5038`
2. Login with batch-call-api credentials
3. Try Originate command to your own phone number
4. Verify call comes through AlienVOIP

### Phase 2: Create AMI Client Library
1. Create `mikopbx-ami-client.ts` in your project
2. Implement connection, login, and Originate functions
3. Add error handling and retry logic
4. Test from local development environment

### Phase 3: Update batch-call-v2 Function
1. Replace Twilio client with MikoPBX AMI client
2. Update call origination logic
3. Update database to log MikoPBX call IDs
4. Deploy to Deno Deploy
5. Test batch calling

### Phase 4: AI WebSocket Integration
1. Update AI handler to register as SIP extension 999
2. Implement SIP WebSocket bridge
3. Test real-time audio streaming
4. Test interruption handling
5. Monitor call quality

---

## 11. Cost Comparison

### Before (Twilio):
- RM 0.03/minute to Malaysia mobile
- 100 calls × 3 minutes avg = RM 9.00

### After (MikoPBX + AlienVOIP):
- RM 0.006-0.01/minute to Malaysia mobile
- 100 calls × 3 minutes avg = RM 1.80 - RM 3.00

**Savings:** ~70% cost reduction 💰

---

## 12. Security Recommendations

### Current Configuration:
⚠️ **Password Reuse:** Extension 999 and AMI account use same password (Dev2025@@)

### Recommended Improvements (After Testing):
1. **Change AMI password** to something different from extension password
2. **Restrict AMI network filter** to Deno Deploy IP ranges only
3. **Enable TLS/SRTP** for SIP encryption (if AlienVOIP supports it)
4. **Rotate passwords regularly** (monthly/quarterly)
5. **Monitor AMI access logs** for unauthorized attempts
6. **Set up fail2ban** for brute force protection

---

## 13. Troubleshooting Guide

### Issue: AlienVOIP trunk shows red (not registered)
**Solutions:**
- Check internet connectivity from MikoPBX
- Verify AlienVOIP account has credits
- Confirm username/password are correct
- Check firewall allows outbound UDP 5060
- Try alternative proxy (sip3.alienvoip.com)

### Issue: AMI connection refused
**Solutions:**
- Verify port 5038 is open in firewall
- Check AMI account is saved and active
- Confirm username/password are correct
- Try from MikoPBX server itself first (localhost)

### Issue: Calls don't go out
**Solutions:**
- Check outbound routing rule is enabled
- Verify AlienVOIP trunk is registered (green)
- Check number format matches routing rule
- Review Asterisk logs: `/var/log/asterisk/messages`
- Test with manual call from extension first

### Issue: No audio on call
**Solutions:**
- Verify RTP ports 10000-10800 are open
- Check NAT settings in provider configuration
- Confirm codec compatibility (G.729, GSM, ulaw)
- Review DTMF mode settings (rfc2833)
- Check AlienVOIP account has sufficient credits

---

## 14. Support Resources

**MikoPBX Documentation:**
- Official Docs: https://docs.mikopbx.com
- AMI API: https://docs.mikopbx.com/mikopbx-development/api/ami-ajam
- Community Forum: https://github.com/mikopbx/Core/discussions

**AlienVOIP Support:**
- Website: https://www.alienvoip.com
- Setup Guides: https://www.alienvoip.com/voip-softswitch-configuration/

**Asterisk AMI Reference:**
- Wiki: https://wiki.asterisk.org/wiki/display/AST/Asterisk+Manager+Interface
- Actions: https://wiki.asterisk.org/wiki/display/AST/ManagerAction_Originate

---

## Configuration Status: ✅ COMPLETE

All MikoPBX configuration is complete and ready for integration with your batch-call-v2 function!

**Last Updated:** 2025-10-22
