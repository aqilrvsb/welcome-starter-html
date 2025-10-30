# MikoPBX Environment Variables Setup

**For Deno Deploy / Supabase Edge Functions**

---

## Required Environment Variables

Add these environment variables to your Deno Deploy project or Supabase Edge Functions configuration.

### 1. MikoPBX AMI Configuration

```bash
MIKOPBX_HOST=68.183.177.218
MIKOPBX_AMI_PORT=5038
MIKOPBX_AMI_USERNAME=batch-call-api
MIKOPBX_AMI_PASSWORD=Dev2025@@
```

**Description:**
- `MIKOPBX_HOST`: IP address of your MikoPBX server on Digital Ocean
- `MIKOPBX_AMI_PORT`: Asterisk Manager Interface port (default: 5038)
- `MIKOPBX_AMI_USERNAME`: AMI account username (created in System → AMI)
- `MIKOPBX_AMI_PASSWORD`: AMI account password

### 2. Existing Variables (Keep These)

```bash
SUPABASE_URL=https://ahexnoaazbveiyhplfrc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  (your service role key)
DENO_DEPLOY_URL=https://sifucall.deno.dev
```

---

## How to Set Environment Variables

### For Deno Deploy:

1. Go to https://dash.deno.com/projects
2. Select your project: `sifucall`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Click **+ Add Variable**
   - Enter Name and Value
   - Click **Save**

### For Supabase Edge Functions:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click on **Environment Variables**
4. Add each variable
5. Redeploy functions

### For Local Development:

Create a `.env` file in your project root:

```bash
# .env (DO NOT COMMIT THIS FILE!)
MIKOPBX_HOST=68.183.177.218
MIKOPBX_AMI_PORT=5038
MIKOPBX_AMI_USERNAME=batch-call-api
MIKOPBX_AMI_PASSWORD=Dev2025@@

SUPABASE_URL=https://ahexnoaazbveiyhplfrc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DENO_DEPLOY_URL=https://sifucall.deno.dev
```

---

## Testing Environment Variables

Test that your env vars are set correctly:

```typescript
// Test in your function
console.log('MIKOPBX_HOST:', Deno.env.get('MIKOPBX_HOST'));
console.log('MIKOPBX_AMI_PORT:', Deno.env.get('MIKOPBX_AMI_PORT'));
console.log('MIKOPBX_AMI_USERNAME:', Deno.env.get('MIKOPBX_AMI_USERNAME'));
// Don't log passwords in production!
```

---

## Security Notes

1. **Never commit `.env` files** to GitHub
2. **Rotate passwords regularly** (monthly recommended)
3. **Use different passwords** for production vs development
4. **Restrict AMI network access** to your Deno Deploy IP ranges (optional, after testing)

---

## Database Configuration

Users must configure their AlienVOIP SIP credentials in the `phone_config` table:

### Required Fields in `phone_config`:

| Field | Example | Description |
|-------|---------|-------------|
| `mikopbx_url` | http://68.183.177.218 | MikoPBX server URL |
| `sip_proxy_primary` | sip1.alienvoip.com | Primary AlienVOIP proxy |
| `sip_proxy_secondary` | sip3.alienvoip.com | Backup AlienVOIP proxy (optional) |
| `sip_username` | 646006395 | User's AlienVOIP SIP username |
| `sip_password` | Xh7Yk5Ydcg | User's AlienVOIP SIP password |
| `sip_codec` | ulaw | Preferred codec (ulaw/g729/gsm) |

**Note:** Each user has their own AlienVOIP credentials, but all users share the same MikoPBX server.

---

## Deployment Checklist

Before deploying to production:

- [ ] Set all environment variables in Deno Deploy
- [ ] Verify MikoPBX server is accessible from internet
- [ ] Confirm AlienVOIP SIP trunk is registered (green status in MikoPBX)
- [ ] Test AMI connection from Deno Deploy
- [ ] Test single call manually
- [ ] Test batch calls (2-3 numbers)
- [ ] Monitor call logs in Supabase
- [ ] Check call quality and audio
- [ ] Verify credits deduction works correctly

---

## Troubleshooting

### Issue: "Connection refused" to MikoPBX

**Solutions:**
1. Check firewall allows port 5038 from Deno Deploy IPs
2. Verify MikoPBX is running: SSH and check `asterisk -rx "core show version"`
3. Test from local machine first: `telnet 68.183.177.218 5038`

### Issue: "Authentication failed"

**Solutions:**
1. Verify AMI username/password are correct
2. Check AMI account has "originate" write permission
3. Recreate AMI account in MikoPBX web interface

### Issue: Calls don't go through

**Solutions:**
1. Check AlienVOIP trunk registration status (must be green)
2. Verify outbound routing is configured
3. Check AlienVOIP account has credits
4. Review Asterisk logs: `/var/log/asterisk/messages`
5. Test manual call from MikoPBX console first

---

## Cost Calculation Updated

### Old (Twilio):
- **Cost:** RM 0.03/minute
- **100 calls × 3 minutes avg:** RM 9.00

### New (AlienVOIP):
- **Cost:** RM 0.006-0.01/minute
- **100 calls × 3 minutes avg:** RM 1.80 - RM 3.00

**Savings:** ~70% reduction in telephony costs! 💰

Update your pricing in batch-call-v2:
```typescript
const costPerMinute = 0.06; // RM0.06/min (updated from RM0.20/min)
```

---

## Next Steps

1. **Set environment variables** in Deno Deploy
2. **Deploy batch-call-v2** with MikoPBX integration
3. **Test with your own phone number** first
4. **Monitor logs** for any errors
5. **Scale up** once testing is successful

---

**Configuration Date:** 2025-10-22
**MikoPBX Version:** 2024.1.114
**Status:** ✅ Ready for deployment
