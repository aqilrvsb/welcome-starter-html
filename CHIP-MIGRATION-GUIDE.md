# CHIP Payment Gateway Migration Guide

Complete guide to migrate from Billplz to CHIP Payment Gateway.

---

## 📋 Overview

This migration replaces Billplz/FPX payment gateway with CHIP Payment Gateway, which supports:
- ✅ FPX (Malaysian online banking)
- ✅ Credit/Debit Cards (Visa, Mastercard)
- ✅ E-Wallets (Touch 'n Go, GrabPay, Boost, etc.)
- ✅ Automatic webhook notifications
- ✅ Comprehensive payment status tracking

---

## 🔑 Step 1: Get CHIP API Credentials

### 1.1 Create CHIP Account
1. Go to [www.chip-in.asia](https://www.chip-in.asia)
2. Sign up for a business account
3. Complete KYC verification

### 1.2 Get API Key
1. Login to CHIP dashboard
2. Click your profile (top right) → **"Developers"**
3. Click **"Keys"** → **"New Live Key"**
4. Enter a title (e.g., "AI Call Center Production")
5. **Copy the API Key** and save it securely

   ```
   Example: FNNXp3wqFR_WzTEte7DqpO2OZ5XMyqkDfT4ivxb4q3oGyWoM4j8Uh3cxTi33CnJHJZlrImjxlZv65v2MdAAk4A==
   ```

### 1.3 Get Brand ID
1. In CHIP dashboard, go to **Developers** → **Brands**
2. **Copy your Brand ID** (UUID format)

   ```
   Example: 550e8400-e29b-41d4-a716-446655440000
   ```

---

## 🗄️ Step 2: Update Database Schema

Run the migration script in your Supabase SQL Editor:

```bash
# File: database-migration-chip.sql
```

### What it does:
- ✅ Adds `chip_purchase_id` column (stores CHIP purchase ID)
- ✅ Adds `chip_checkout_url` column (stores CHIP payment URL)
- ✅ Adds `refunded` status to payment status constraint
- ✅ Creates indexes for performance optimization

### To run:
1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy contents of `database-migration-chip.sql`
4. Click **Run**
5. Verify: Should see "Success. No rows returned"

---

## ⚙️ Step 3: Set Environment Variables

### 3.1 In Supabase Dashboard

1. Go to **Project Settings** → **Edge Functions**
2. Scroll to **Environment Variables**
3. Add these variables:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `CHIP_API_KEY` | Your CHIP API Key | `FNNXp3wqFR_WzTE...` |
| `CHIP_BRAND_ID` | Your CHIP Brand ID | `550e8400-e29b-41d4-...` |
| `APP_ORIGIN` | Your frontend URL | `https://aicallpro.com` |

### 3.2 Verify Existing Variables

Make sure these are already set:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Step 4: Deploy Edge Function

### 4.1 Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### 4.2 Login to Supabase

```bash
supabase login
```

### 4.3 Link Your Project

```bash
supabase link --project-ref your-project-ref
```

### 4.4 Deploy the Function

```bash
cd C:\Users\aqilz\Documents\welcome-starter-html-master
supabase functions deploy billplz-credits-topup
```

**Expected output:**
```
Deploying function billplz-credits-topup...
✓ Function deployed successfully
URL: https://your-project.supabase.co/functions/v1/billplz-credits-topup
```

---

## 🔔 Step 5: Configure CHIP Webhook

### 5.1 Get Your Webhook URL

Your webhook URL format:
```
https://YOUR-PROJECT.supabase.co/functions/v1/billplz-credits-topup
```

Example:
```
https://abcdefgh12345678.supabase.co/functions/v1/billplz-credits-topup
```

### 5.2 Create Webhook in CHIP Dashboard

1. Login to CHIP dashboard
2. Go to **Developers** → **Webhooks**
3. Click **"Create New Webhook"**
4. Fill in:
   - **Name**: AI Call Center Production
   - **URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/billplz-credits-topup`
   - **Events to subscribe**:
     - ✅ `purchase.paid` (payment successful)
     - ✅ `purchase.payment_failure` (payment failed)
     - ✅ `purchase.cancelled` (payment cancelled)
     - ✅ `purchase.refunded` (payment refunded)
5. Click **Save**

### 5.3 Test Webhook (Optional)

In CHIP dashboard, you can send a test webhook to verify it's working.

---

## 🌐 Step 6: Deploy Frontend Changes

### 6.1 Build Frontend

```bash
cd C:\Users\aqilz\Documents\welcome-starter-html-master
npm run build
```

### 6.2 Deploy to Vercel (or your hosting)

```bash
# If using Vercel CLI
vercel --prod

# Or push to GitHub and let Vercel auto-deploy
git add .
git commit -m "Migrate from Billplz to CHIP Payment Gateway"
git push origin main
```

---

## 🧪 Step 7: Test Payment Flow

### Test in Staging/Development

1. Go to your frontend: `https://your-domain.com/credits-topup`
2. Select **RM10** top-up
3. Click **"Pay with CHIP"**
4. You'll be redirected to CHIP payment page
5. Use CHIP test cards (if in test mode):
   - **Success**: Card `4242424242424242`, any CVV, any future expiry
   - **Failed**: Card `4000000000000002`
6. Complete payment
7. Verify:
   - ✅ Redirected back to `/credits-topup?status=success`
   - ✅ Credits added to your account
   - ✅ Transaction appears in "Recent Transactions"
   - ✅ Check Supabase logs for webhook logs

### Check Logs

#### Edge Function Logs:
1. Supabase Dashboard → **Edge Functions**
2. Select `billplz-credits-topup`
3. Click **Logs**
4. Look for:
   ```
   ✅ CHIP purchase created: 550e8400-...
   🔔 CHIP Webhook received
   💰 Payment SUCCESSFUL - Adding RM10 credits
   ✅ Credits added successfully
   ```

#### Database Verification:
```sql
-- Check payment record
SELECT * FROM payments
WHERE chip_purchase_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Check credits transaction
SELECT * FROM credits_transactions
WHERE transaction_type = 'topup'
ORDER BY created_at DESC
LIMIT 5;

-- Check user balance
SELECT id, username, credits_balance, pro_balance_minutes
FROM users
WHERE id = 'YOUR_USER_ID';
```

---

## 📊 Step 8: Monitor & Verify

### Things to Monitor

1. **Payment Success Rate**
   - Check CHIP dashboard for payment analytics
   - Compare with previous Billplz rates

2. **Webhook Delivery**
   - CHIP dashboard shows webhook delivery status
   - Check Edge Function logs for webhook processing

3. **Credit Addition**
   - Verify credits are added correctly
   - Check for duplicate credit additions (should not happen)

4. **User Experience**
   - Test on mobile devices
   - Test different payment methods (FPX, cards, e-wallets)

---

## 🔒 Security Considerations

### Webhook Security

The current implementation accepts webhooks with `X-Signature` header but doesn't verify the signature yet. For production, you should:

1. Get CHIP's public key from webhook settings
2. Verify RSA signature in webhook handler
3. Reject webhooks with invalid signatures

### Example signature verification (add to `handleWebhook` function):

```typescript
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  // Get CHIP public key from environment or database
  const publicKey = Deno.env.get('CHIP_WEBHOOK_PUBLIC_KEY');

  if (!publicKey) {
    console.warn('⚠️ Webhook public key not configured - skipping verification');
    return true; // Allow in dev, but log warning
  }

  // TODO: Implement RSA signature verification
  // using Web Crypto API or similar library

  return true;
}
```

---

## 🐛 Troubleshooting

### Issue: "CHIP API keys not configured"

**Solution:**
- Verify environment variables are set in Supabase Dashboard
- Redeploy the Edge Function after setting variables
- Check variable names match exactly (case-sensitive)

### Issue: "Payment created but credits not added"

**Solution:**
- Check Edge Function logs for webhook delivery
- Verify webhook is configured correctly in CHIP dashboard
- Check webhook URL is correct (no trailing slash)
- Verify CHIP sent `purchase.paid` event

### Issue: "Webhook not received"

**Solution:**
- Check CHIP dashboard → Webhooks → Delivery logs
- Verify your Edge Function is deployed and accessible
- Test webhook URL manually: `curl -X POST https://your-project.supabase.co/functions/v1/billplz-credits-topup`
- Check firewall/security rules

### Issue: "Double credit addition"

**Solution:**
- This should not happen due to status checks in code
- If it does, check database for duplicate `chip_purchase_id` entries
- Review Edge Function logs for repeated webhook deliveries

---

## 📈 CHIP Status Reference

Understanding CHIP payment statuses:

| CHIP Status | Your Status | Credits Added? | Description |
|-------------|-------------|----------------|-------------|
| `paid` | `paid` | ✅ Yes | Payment successful |
| `error` | `failed` | ❌ No | Payment processing error |
| `cancelled` | `failed` | ❌ No | User cancelled payment |
| `expired` | `failed` | ❌ No | Payment link expired |
| `charged_back` | `failed` | ❌ No | Chargeback issued |
| `created` | `pending` | ❌ No | Payment initiated |
| `sent` | `pending` | ❌ No | Invoice sent via email |
| `viewed` | `pending` | ❌ No | User viewed payment page |
| `pending_execute` | `pending` | ❌ No | Payment being processed |
| `refunded` | `refunded` | ❌ No | Payment refunded |

---

## 🔄 Rollback Plan

If you need to rollback to Billplz:

1. **Restore Edge Function:**
   ```bash
   git checkout HEAD~1 -- supabase/functions/billplz-credits-topup/index.ts
   supabase functions deploy billplz-credits-topup
   ```

2. **Update Frontend:**
   ```bash
   git checkout HEAD~1 -- src/pages/CreditsTopup.tsx
   npm run build
   vercel --prod
   ```

3. **Update Environment Variables:**
   - Set `BILLPLZ_API_KEY`
   - Set `BILLPLZ_COLLECTION_ID`

4. **Database:** (schema changes are backward compatible)

---

## 📞 Support

- **CHIP Support:** support@chip-in.asia
- **CHIP Docs:** https://docs.chip-in.asia
- **CHIP Dashboard:** https://www.chip-in.asia

---

## ✅ Migration Checklist

- [ ] Created CHIP account and completed KYC
- [ ] Obtained CHIP API Key
- [ ] Obtained CHIP Brand ID
- [ ] Ran database migration script
- [ ] Set environment variables in Supabase
- [ ] Deployed Edge Function
- [ ] Configured CHIP webhook
- [ ] Deployed frontend changes
- [ ] Tested payment flow (test mode)
- [ ] Verified credits are added correctly
- [ ] Tested on production (small amount first)
- [ ] Monitored logs for 24 hours
- [ ] Updated monitoring/alerting
- [ ] Documented for team

---

**Migration completed!** 🎉

Your system now uses CHIP Payment Gateway for all credit top-ups.
