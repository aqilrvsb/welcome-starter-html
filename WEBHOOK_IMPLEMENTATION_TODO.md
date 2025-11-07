# 🎯 Webhook System Implementation - TODO

## ✅ COMPLETED (Part 1):

1. **SQL Migration** (`add_webhook_system.sql`):
   - ✅ Added unique constraints for prompt names per user
   - ✅ Added unique constraints for campaign names per user
   - ✅ Created `webhooks` table with name-based routing
   - ✅ Created `webhook_logs` table for monitoring
   - ✅ RLS policies for security
   - ✅ Auto-generate webhook tokens and URLs
   - ✅ Performance indexes

2. **Prompt Form Updates**:
   - ✅ Unique name error handling

---

## 🚧 REMAINING WORK (Part 2):

### 1. Update Campaign Form (Similar to Prompt Form)

**File**: `src/components/campaigns/CampaignForm.tsx` (or similar)

**Changes Needed**:
```typescript
onError: (error: any) => {
  // Check for unique constraint violation
  if (error.message?.includes('campaigns_user_id_campaign_name_unique') ||
      error.message?.includes('duplicate key')) {
    toast.error("❌ Nama campaign sudah wujud! Sila gunakan nama yang berbeza.");
  } else {
    toast.error("Gagal menyimpan campaign: " + error.message);
  }
}
```

---

### 2. Create Webhook Handler Edge Function

**File**: `supabase/functions/webhook-handler/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');

    // Extract type and token
    // URL format: /webhook/lead/{token} or /webhook/lead-call/{token}
    const type = pathParts[2]; // 'lead' or 'lead-call'
    const token = pathParts[3];

    // 1. Find webhook by token
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('webhook_token', token)
      .eq('is_active', true)
      .single();

    if (error || !webhook) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid webhook token' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request body
    const body = await req.json();
    const { name, phone_number, product, prompt_name, campaign_name } = body;

    // Validation
    if (!name || !phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'name and phone_number are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        user_id: webhook.user_id,
        name,
        phone_number,
        product: product || null
      })
      .select()
      .single();

    if (contactError) {
      await logWebhookRequest(webhook.id, body, 'error', null, null, contactError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create contact' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let callId = null;

    // 4. If lead_and_call type, initiate call
    if (webhook.webhook_type === 'lead_and_call') {
      // Get prompt_id (from override or default)
      const promptNameToUse = prompt_name || webhook.default_prompt_name;

      const { data: prompt } = await supabase
        .from('prompts')
        .select('id')
        .eq('user_id', webhook.user_id)
        .eq('prompt_name', promptNameToUse)
        .single();

      if (!prompt) {
        await logWebhookRequest(webhook.id, body, 'error', contact.id, null, 'Prompt not found');
        return new Response(
          JSON.stringify({ success: false, error: `Prompt "${promptNameToUse}" not found` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get campaign_id if provided
      let campaignId = null;
      if (campaign_name || webhook.default_campaign_name) {
        const campaignNameToUse = campaign_name || webhook.default_campaign_name;
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', webhook.user_id)
          .eq('campaign_name', campaignNameToUse)
          .single();

        if (campaign) {
          campaignId = campaign.id;
        }
      }

      // Create call via initiate-call edge function
      callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Call initiate-call function (or create call_logs directly)
      await supabase
        .from('call_logs')
        .insert({
          user_id: webhook.user_id,
          call_id: callId,
          phone_number,
          contact_id: contact.id,
          prompt_id: prompt.id,
          campaign_id: campaignId,
          status: 'queued'
        });
    }

    // 5. Log success
    await logWebhookRequest(webhook.id, body, 'success', contact.id, callId, null);

    // 6. Update webhook stats
    await supabase
      .from('webhooks')
      .update({
        total_requests: webhook.total_requests + 1,
        successful_requests: webhook.successful_requests + 1,
        last_request_at: new Date().toISOString()
      })
      .eq('id', webhook.id);

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contact.id,
        call_id: callId,
        message: callId ? 'Contact created and call initiated' : 'Contact created'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function logWebhookRequest(webhookId, payload, status, contactId, callId, errorMessage) {
  await supabase
    .from('webhook_logs')
    .insert({
      webhook_id: webhookId,
      request_payload: payload,
      response_status: status,
      contact_id: contactId,
      call_id: callId,
      error_message: errorMessage
    });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

### 3. Create Webhook Management UI

**File**: `src/pages/dashboard/Webhooks.tsx` (new file)

**Features**:
- List all webhooks
- Create new webhook (with type selection, defaults)
- View webhook URL and copy button
- View stats (total requests, success rate)
- View recent logs
- Enable/disable webhook
- Delete webhook

**UI Structure**:
```tsx
export default function Webhooks() {
  return (
    <div>
      <h1>Webhook Management</h1>

      {/* Create Webhook Button */}
      <Button onClick={() => setShowCreateDialog(true)}>
        Create New Webhook
      </Button>

      {/* Webhooks List */}
      <div className="grid">
        {webhooks.map(webhook => (
          <WebhookCard key={webhook.id} webhook={webhook} />
        ))}
      </div>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateDialog}>
        <DialogContent>
          <Select webhook_type>
            <option value="lead_only">Lead Only</option>
            <option value="lead_and_call">Lead + Auto Call</option>
          </Select>

          <Select default_prompt>
            {prompts.map(p => <option>{p.prompt_name}</option>)}
          </Select>

          <Select default_campaign (optional)>
            {campaigns.map(c => <option>{c.campaign_name}</option>)}
          </Select>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

### 4. Add to Dashboard Navigation

**File**: `src/App.tsx` or router config

```tsx
<Route path="/dashboard/webhooks" element={<Webhooks />} />
```

---

### 5. Run SQL Migration

```bash
# In Supabase SQL Editor, run:
add_webhook_system.sql
```

---

### 6. Deploy Edge Function

```bash
npx supabase functions deploy webhook-handler
```

---

### 7. Update Webhook URL in SQL Function

After deploying, update the `set_webhook_url()` function in the SQL migration to use your actual Supabase edge function URL:

```sql
-- Update line 82 in add_webhook_system.sql:
NEW.webhook_url := 'https://your-project-ref.supabase.co/functions/v1/webhook/' || NEW.webhook_type || '/' || NEW.webhook_token;
```

---

## 📖 TESTING

1. Create a prompt with unique name
2. Create a campaign with unique name
3. Create a webhook (lead_and_call type)
4. Test webhook with curl:

```bash
curl -X POST https://your-domain/webhook/lead-call/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone_number": "+60123456789",
    "product": "Premium Package"
  }'
```

Expected response:
```json
{
  "success": true,
  "contact_id": "uuid-here",
  "call_id": "call_xyz123",
  "message": "Contact created and call initiated"
}
```

---

## 🎯 BENEFITS

✅ Clients never need to know UUIDs
✅ Simple integration (just POST name + phone)
✅ Advanced users can override with names
✅ Auto-logging for debugging
✅ Stats tracking
✅ Easy to test and monitor

---

Would you like me to continue with Part 2 in the next session?
