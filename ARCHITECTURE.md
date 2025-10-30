# Architecture - Custom AI Call Pipeline with Azure STT

## System Overview

This is a **white-label AI call platform** where YOU control the infrastructure and generate profit by charging clients more than your actual costs.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Business Model                       │
├─────────────────────────────────────────────────────────────────┤
│  200 Clients → Each makes 1000 concurrent calls                 │
│  You own ALL API keys (Azure, OpenRouter, ElevenLabs)          │
│  Clients buy credits from YOU via Billplz/FPX                  │
│  You charge $0.20/min → Your cost $0.12/min → Profit $0.08/min │
└─────────────────────────────────────────────────────────────────┘
```

## Call Flow Architecture

```
┌──────────┐
│  Caller  │
└─────┬────┘
      │ ① Twilio receives call
      ↓
┌─────────────┐
│   Twilio    │ ② Connects to WebSocket
│ (Client's)  │
└─────┬───────┘
      │ WebSocket: wss://your-supabase.functions.supabase.co/ai-call-handler-azure
      ↓
┌─────────────────────────────────────────────────────────────────┐
│          Supabase Edge Function: ai-call-handler-azure          │
│                    (Real-time WebSocket Handler)                │
├─────────────────────────────────────────────────────────────────┤
│  ③ Audio Stream (µ-law) → Azure Speech STT WebSocket           │
│     ↓                                                            │
│  ④ Text transcript → OpenRouter LLM (Llama 3.1 70B)            │
│     ↓                                                            │
│  ⑤ AI Response Text → ElevenLabs TTS (Turbo v2.5)              │
│     ↓                                                            │
│  ⑥ Audio (µ-law) → Back to Twilio                              │
└─────────────────────────────────────────────────────────────────┘
      │
      ↓
┌──────────┐
│  Caller  │ ⑦ Hears AI response
└──────────┘
```

## Components Breakdown

### 1. Frontend (React + TypeScript + Vite)

**Purpose:** Client dashboard for managing campaigns, contacts, and credits

**Key Pages:**
- `/dashboard` - Overview of campaigns and usage
- `/campaigns` - Create and manage call campaigns
- `/contacts` - Manage customer contact lists
- `/credits-topup` - Buy credits via Billplz/FPX
- `/call-logs` - View call history and transcripts

**Technologies:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Supabase JS client for backend integration

### 2. Database (Supabase PostgreSQL)

**Purpose:** Store users, campaigns, contacts, credits, call logs, and costs

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `users` | Client accounts (username, password_hash, credits_balance) |
| `campaigns` | Call campaigns (prompt, numbers, status) |
| `contacts` | Customer phone numbers |
| `call_logs` | Individual call records with transcripts |
| `call_costs` | Detailed cost breakdown per call |
| `credits_transactions` | All credit movements (topup, deduction, refund) |
| `phone_config` | Client's Twilio credentials |

**Key Functions:**
- `add_credits(user_id, amount, payment_id, description)` - Add credits
- `deduct_credits(user_id, amount, call_id, description)` - Deduct credits
- `has_sufficient_credits(user_id, required_amount)` - Check balance

### 3. Edge Function: ai-call-handler-azure

**Purpose:** Real-time WebSocket handler for live calls

**File:** `supabase/functions/ai-call-handler-azure/index.ts`

**Flow:**
1. Accepts WebSocket connection from Twilio
2. Receives audio stream (µ-law format at 8kHz)
3. Forwards audio to Azure Speech STT WebSocket
4. Receives text transcript from Azure
5. Sends transcript to OpenRouter LLM
6. Gets AI response text
7. Converts text to speech via ElevenLabs TTS API
8. Streams audio back to Twilio → Caller hears AI

**Key Features:**
- Session management (stores conversation history)
- Cost tracking (Azure STT + LLM + TTS + Twilio)
- Transcript recording
- Automatic credit deduction on call end

**Environment Variables:**
- `AZURE_SPEECH_KEY` - Your Azure Speech Services key
- `AZURE_SPEECH_REGION` - Azure region (e.g., `southeastasia`)
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

### 4. Edge Function: batch-call-v2

**Purpose:** Initiates batch calls to multiple phone numbers

**File:** `supabase/functions/batch-call-v2/index.ts`

**Flow:**
1. Receives request with campaign details and phone numbers
2. Validates client has sufficient credits
3. Creates campaign record in database
4. For each phone number:
   - Generates TwiML with WebSocket connection to ai-call-handler-azure
   - Passes custom parameters (user_id, campaign_id, system_prompt, first_message)
   - Makes Twilio API call to initiate call
   - Logs call record
5. Returns summary (success/failure count)

**Key Features:**
- Concurrent call processing (all calls initiated in parallel)
- Phone number validation and formatting
- Credit balance checking
- Variable replacement in prompts ({{customer_name}}, {{phone_number}})

**TwiML Structure:**
```xml
<Response>
  <Connect>
    <Stream url="wss://your-supabase.functions.supabase.co/ai-call-handler-azure">
      <Parameter name="user_id" value="..." />
      <Parameter name="campaign_id" value="..." />
      <Parameter name="system_prompt" value="..." />
      <Parameter name="first_message" value="..." />
    </Stream>
  </Connect>
</Response>
```

### 5. Edge Function: billplz-credits-topup

**Purpose:** Handles credit purchases via Billplz payment gateway

**File:** `supabase/functions/billplz-credits-topup/index.ts`

**Flow:**

**Creating Payment:**
1. Client selects amount (e.g., RM50)
2. Creates payment record in database
3. Creates Billplz bill via API
4. Returns Billplz payment URL
5. Client redirected to Billplz → pays via FPX/online banking

**Webhook (when payment succeeds):**
1. Billplz calls webhook with payment status
2. Verifies payment signature
3. If `paid=true`, calls `add_credits()` function
4. Updates payment record to `completed`
5. Client's credits balance updated

**Environment Variables:**
- `BILLPLZ_API_KEY` - Your Billplz API secret key
- `BILLPLZ_COLLECTION_ID` - Your Billplz collection ID
- `APP_ORIGIN` - Your app domain (for redirects)

## Cost Tracking System

### Real-time Cost Calculation

Every call tracks costs in the `call_costs` table:

```sql
CREATE TABLE call_costs (
  id UUID PRIMARY KEY,
  call_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  campaign_id UUID,
  duration_minutes DECIMAL(10, 2),

  -- Cost breakdown
  azure_stt_cost DECIMAL(10, 4),      -- $0.0167/min
  llm_cost DECIMAL(10, 4),            -- ~$0.0043/min
  tts_cost DECIMAL(10, 4),            -- ~$0.072/min
  twilio_cost DECIMAL(10, 4),         -- ~$0.013/min
  total_provider_cost DECIMAL(10, 4), -- Sum of above

  -- Revenue
  charged_amount DECIMAL(10, 2),      -- $0.20/min charged to client
  profit_margin DECIMAL(10, 2),       -- charged_amount - total_provider_cost

  -- Status
  status TEXT DEFAULT 'pending',      -- pending | charged | failed
  charged_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB                       -- Transcript, conversation history
);
```

### Cost Calculation Formulas

**Azure STT:**
```typescript
session.costs.azure_stt = durationMinutes * 0.0167; // $1 per hour
```

**LLM (OpenRouter):**
```typescript
const tokensUsed = data.usage?.total_tokens || 0;
session.costs.llm += (tokensUsed / 1000000) * 0.52; // $0.52 per 1M tokens
```

**TTS (ElevenLabs):**
```typescript
const characterCount = text.length;
session.costs.tts += (characterCount / 1000) * 0.18; // $0.18 per 1K chars
```

**Twilio (estimated):**
```typescript
session.costs.twilio = durationMinutes * 0.013; // ~$0.013/min
```

**Total & Profit:**
```typescript
const totalCost = azure_stt + llm + tts + twilio;
const chargedAmount = durationMinutes * 0.20; // What client pays
const profit = chargedAmount - totalCost;
```

## Credits System

### Credit Balance

Each user has a `credits_balance` column (in USD):

```sql
ALTER TABLE users ADD COLUMN credits_balance DECIMAL(10, 2) DEFAULT 0.00;
```

### Credit Transactions

All credits movements logged in `credits_transactions`:

```sql
CREATE TABLE credits_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,        -- Positive = add, Negative = deduct
  transaction_type TEXT NOT NULL,         -- topup | deduction | refund | bonus
  balance_before DECIMAL(10, 2),
  balance_after DECIMAL(10, 2),
  reference_id TEXT,                      -- payment_id or call_id
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Credit Flow

**1. Client Buys Credits (Top-Up):**
```
Client → Billplz → Pays RM50 → Webhook → add_credits()
→ credits_balance += $12 (RM50 ≈ $12 at RM4.2/USD)
→ Transaction: type=topup, amount=+$12
```

**2. Client Makes Call (Deduction):**
```
Call duration: 5 minutes
Charged: 5 min × $0.20/min = $1.00
→ deduct_credits(user_id, $1.00, call_id, "Call charge")
→ credits_balance -= $1.00
→ Transaction: type=deduction, amount=-$1.00
```

**3. Call Fails (Refund):**
```
If call fails, credits can be refunded:
→ add_credits(user_id, $1.00, call_id, "Refund for failed call")
→ Transaction: type=refund, amount=+$1.00
```

## Scaling Considerations

### 200 Clients × 1000 Calls = 200,000 Concurrent Calls

**Bottlenecks to Address:**

1. **Supabase Edge Functions**
   - Default: Auto-scales
   - Monitor: CPU and memory usage
   - Upgrade: Enterprise plan if needed

2. **Azure Speech Services**
   - Check quota limits in Azure Portal
   - Request quota increase if needed
   - Consider multiple regions for redundancy

3. **OpenRouter**
   - Llama 3.1 70B has high throughput
   - Monitor rate limits (requests per minute)
   - Consider higher tier plan

4. **ElevenLabs**
   - Turbo v2.5 optimized for low latency
   - Check character quota
   - Upgrade plan if needed

5. **Twilio**
   - Each client uses their own Twilio account
   - No bottleneck on your side
   - Clients must ensure their Twilio limits are adequate

6. **Database Connections**
   - Supabase handles connection pooling
   - Monitor with Supabase Dashboard
   - Upgrade to dedicated compute if needed

## Security

### API Key Management

**You control ALL provider API keys:**
- Azure Speech: Stored as `AZURE_SPEECH_KEY` environment variable
- OpenRouter: Stored as `OPENROUTER_API_KEY` environment variable
- ElevenLabs: Stored as `ELEVENLABS_API_KEY` environment variable

**Clients NEVER see these keys.**

### Client Credentials

**Clients provide:**
- Twilio Account SID
- Twilio Auth Token
- Twilio Phone Number

**Stored in:** `phone_config` table (encrypted at rest by Supabase)

### Row Level Security (RLS)

All tables have RLS policies:
```sql
-- Example: Users can only see their own data
CREATE POLICY "Users view own data"
ON campaigns FOR SELECT
USING (auth.uid() = user_id);
```

### Credits Security

Credits deduction uses database function with atomic transaction:
```sql
CREATE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount DECIMAL,
  p_call_id TEXT,
  p_description TEXT
) RETURNS void AS $
BEGIN
  -- Check sufficient balance
  IF (SELECT credits_balance FROM users WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Atomic deduction
  UPDATE users
  SET credits_balance = credits_balance - p_amount
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO credits_transactions (...) VALUES (...);
END;
$ LANGUAGE plpgsql;
```

## Monitoring & Observability

### Key Metrics to Track

1. **Business Metrics:**
   - Total revenue (sum of charged_amount)
   - Total cost (sum of total_provider_cost)
   - Profit margin (revenue - cost)
   - Average call duration
   - Call success rate

2. **Technical Metrics:**
   - WebSocket connection success rate
   - Azure STT latency
   - OpenRouter response time
   - ElevenLabs TTS latency
   - Edge function cold starts

3. **User Metrics:**
   - Credits top-up conversion rate
   - Average credits balance per user
   - Monthly active users
   - Churn rate

### Monitoring Tools

**Supabase Dashboard:**
- Database usage
- Edge function logs
- API usage

**Viewing Logs:**
```bash
supabase functions logs ai-call-handler-azure --follow
supabase functions logs batch-call-v2 --follow
supabase functions logs billplz-credits-topup --follow
```

**Database Queries:**
```sql
-- Today's revenue
SELECT SUM(charged_amount) FROM call_costs
WHERE DATE(charged_at) = CURRENT_DATE;

-- Today's profit
SELECT SUM(profit_margin) FROM call_costs
WHERE DATE(charged_at) = CURRENT_DATE;

-- Top 10 users by usage
SELECT user_id, SUM(duration_minutes) as total_minutes
FROM call_costs
GROUP BY user_id
ORDER BY total_minutes DESC
LIMIT 10;
```

## Development Workflow

### Local Development

```bash
# Start Supabase locally (optional)
supabase start

# Run frontend
npm run dev

# Test edge functions locally
supabase functions serve ai-call-handler-azure
```

### Deployment

```bash
# Deploy edge functions
supabase functions deploy ai-call-handler-azure
supabase functions deploy batch-call-v2
supabase functions deploy billplz-credits-topup

# Deploy frontend (example with Vercel)
vercel --prod
```

### Testing

```bash
# Test single call
curl -X POST https://your-supabase.functions.supabase.co/batch-call-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "campaignName": "Test Campaign",
    "phoneNumbers": ["+60123456789"]
  }'

# Test credits top-up
curl -X POST https://your-supabase.functions.supabase.co/billplz-credits-topup \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "userId": "your-user-id"
  }'
```

## Profit Calculation Example

### Scenario: 1 Client, 1000 Calls, 2 Minutes Each

**Costs:**
```
Azure STT:     1000 calls × 2 min × $0.0167/min = $33.40
OpenRouter:    1000 calls × 2 min × $0.0043/min = $8.60
ElevenLabs:    1000 calls × 2 min × $0.072/min  = $144.00
Twilio:        1000 calls × 2 min × $0.013/min  = $26.00
----------------------------------------
Total Cost:                               $212.00
```

**Revenue:**
```
Charged to Client: 1000 calls × 2 min × $0.20/min = $400.00
```

**Profit:**
```
Profit = $400.00 - $212.00 = $188.00
Profit Margin = 47% 🎉
```

### Scenario: 200 Clients, 1000 Calls Each, 2 Minutes Each

**Total Calls:** 200,000 calls

**Costs:**
```
Total Cost: 200 clients × $212.00 = $42,400.00
```

**Revenue:**
```
Total Revenue: 200 clients × $400.00 = $80,000.00
```

**Profit:**
```
Total Profit = $80,000.00 - $42,400.00 = $37,600.00
Monthly Profit = $37,600.00 (if they call once per month)
```

**This is YOUR profit! 💰**

---

## Summary

✅ **You own the infrastructure**
✅ **Clients pay YOU, not external providers**
✅ **40%+ profit margin per call**
✅ **Scales to 200,000+ concurrent calls**
✅ **Full cost tracking and transparency**
✅ **Azure Speech for high-quality transcription**
✅ **OpenRouter for cost-effective LLM**
✅ **ElevenLabs for natural-sounding voice**

Ready to deploy? See [QUICK_DEPLOY.md](QUICK_DEPLOY.md)
