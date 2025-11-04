# Webhook Handler - Deno Deploy

This webhook handler is deployed on **Deno Deploy** (same as `ai-call-handler-freeswitch`).

## 🚀 Deployment Instructions

### 1. Create New Deno Deploy Project

1. Go to [Deno Deploy Dashboard](https://dash.deno.com)
2. Click "New Project"
3. Choose a name (example: `sifucall-webhook`)
4. Connect your GitHub repository
5. Set the **Entry point**: `deno-deploy-webhook/index.ts`

### 2. Set Environment Variables

In Deno Deploy project settings, add these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy

Deno Deploy will automatically deploy when you push to GitHub.

Your webhook will be available at:
- **Lead only**: `https://YOUR_PROJECT.deno.dev/lead/{token}`
- **Lead + Call**: `https://YOUR_PROJECT.deno.dev/lead-call/{token}`

### 4. Update Database

1. Open Supabase SQL Editor
2. Edit `add_webhook_system.sql`
3. Replace `YOUR_DENO_PROJECT` with your actual Deno Deploy project name
4. Run the SQL script

Example:
```sql
-- Replace this:
'https://YOUR_DENO_PROJECT.deno.dev/lead/' || NEW.webhook_token;

-- With this:
'https://sifucall-webhook.deno.dev/lead/' || NEW.webhook_token;
```

## 📝 Testing Your Webhook

### Test Lead Only Webhook

```bash
curl -X POST https://YOUR_PROJECT.deno.dev/lead/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmad Ali",
    "phone_number": "+60123456789",
    "product": "Premium Plan"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Contact created successfully",
  "data": {
    "contact_id": "uuid-here",
    "name": "Ahmad Ali",
    "phone": "+60123456789"
  }
}
```

### Test Lead + Call Webhook

```bash
curl -X POST https://YOUR_PROJECT.deno.dev/lead-call/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Siti Aminah",
    "phone_number": "+60123456789",
    "product": "Basic Plan",
    "prompt_name": "Sales Script v2",
    "campaign_name": "March Promo"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Contact created and call initiated successfully",
  "data": {
    "contact_id": "uuid-here",
    "name": "Siti Aminah",
    "phone": "+60123456789",
    "call_id": "uuid-here"
  }
}
```

## 🔍 Monitoring

- View logs in Deno Deploy dashboard
- View webhook stats in your app's `/webhooks` page
- Check `webhook_logs` table in Supabase

## 🆚 Why Deno Deploy instead of Supabase Edge Functions?

✅ **Separate deployment** - Won't affect Supabase function limits
✅ **Better for webhooks** - Optimized for high-volume HTTP endpoints
✅ **Custom domains** - Easier to setup
✅ **Same stack** - You already use Deno Deploy for batch calls
✅ **Better logging** - Deno Deploy has excellent log viewer

## 📦 Payload Reference

### Required Fields
- `name` (string) - Contact name
- `phone_number` (string) - Phone number with country code

### Optional Fields
- `product` (string) - Product/service info (saved to contact)
- `prompt_name` (string) - Override default prompt (lead_and_call only)
- `campaign_name` (string) - Override default campaign (lead_and_call only)

## 🔐 Security

- Each webhook has a unique 16-character token
- Tokens are randomly generated and stored in database
- Can be disabled anytime via UI
- All requests are logged with IP and user agent
