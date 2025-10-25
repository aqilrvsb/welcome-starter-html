# Quick Start Guide

Get your enterprise AI call handler deployed in 15 minutes.

## Prerequisites Checklist

- [ ] Cloudflare account (sign up at https://dash.cloudflare.com/sign-up)
- [ ] Cloudflare Workers Paid plan ($5/month - upgrade at https://dash.cloudflare.com/workers)
- [ ] OpenAI API key (get at https://platform.openai.com/api-keys)
- [ ] Supabase project (create at https://app.supabase.com)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Git installed (`git --version`)

## Step 1: Clone and Setup (2 minutes)

```bash
# Navigate to the project directory
cd supabase/functions/ai-call-handler-cloudflare

# Install dependencies
npm install

# Make setup script executable (Linux/Mac)
chmod +x setup.sh
```

## Step 2: Configure Environment (3 minutes)

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your credentials
nano .env  # or use your favorite editor
```

Fill in these required values:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 3: Login to Cloudflare (1 minute)

```bash
# Login via browser
npx wrangler login

# Verify login
npx wrangler whoami
```

Expected output:
```
┌──────────────────────────────────────┐
│ Account Name   │ Account ID          │
├────────────────┼─────────────────────┤
│ Your Name      │ abc123def456...     │
└──────────────────────────────────────┘
```

## Step 4: Automated Setup (5 minutes)

### Option A: Automated Script (Recommended)

```bash
# Run setup script (creates KV, R2, sets secrets, deploys)
bash setup.sh
```

The script will:
1. Create KV namespaces (RATE_LIMIT_KV, CACHE_KV)
2. Create R2 bucket (call-recordings-production)
3. Set secrets (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
4. Update wrangler.toml with resource IDs
5. Deploy to Cloudflare

### Option B: Manual Setup

If the script doesn't work, run these commands manually:

```bash
# 1. Create KV namespaces
npx wrangler kv:namespace create "RATE_LIMIT_KV"
npx wrangler kv:namespace create "RATE_LIMIT_KV" --preview
npx wrangler kv:namespace create "CACHE_KV"
npx wrangler kv:namespace create "CACHE_KV" --preview

# Copy the IDs from output and update wrangler.toml

# 2. Create R2 bucket
npx wrangler r2 bucket create call-recordings-production

# 3. Set secrets
echo "your-openai-api-key" | npx wrangler secret put OPENAI_API_KEY
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-supabase-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 4. Deploy
npx wrangler deploy
```

## Step 5: Verify Deployment (2 minutes)

```bash
# Get your worker URL from the deployment output
# Example: https://ai-call-handler-cloudflare.your-username.workers.dev

# Test health endpoint
curl https://ai-call-handler-cloudflare.your-username.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0",
  "activeCalls": 0,
  "uptime": 123
}
```

## Step 6: Test WebSocket Connection (2 minutes)

```bash
# Install wscat (WebSocket CLI tool)
npm install -g wscat

# Connect to WebSocket
wscat -c wss://ai-call-handler-cloudflare.your-username.workers.dev/ws/call-session

# Send test message
> {"type":"start_call","callId":"test-123","userId":"user-456","metadata":{}}

# You should receive a response like:
< {"type":"status","status":"ready","message":"Call session initialized"}
```

## Step 7: Update FreeSWITCH Configuration (5 minutes)

Edit your FreeSWITCH dialplan to use the Cloudflare Worker:

```bash
# SSH to FreeSWITCH server
ssh root@your-freeswitch-server

# Edit dialplan
nano /usr/local/freeswitch/conf/dialplan/default.xml
```

Add this WebSocket endpoint configuration:
```xml
<extension name="ai_call_handler">
  <condition field="destination_number" expression="^(.*)$">
    <action application="answer"/>
    <action application="set" data="websocket_url=wss://ai-call-handler-cloudflare.your-username.workers.dev/ws/call-session"/>
    <action application="lua" data="ai_call_handler.lua"/>
  </condition>
</extension>
```

Save and reload FreeSWITCH:
```bash
fs_cli -x "reloadxml"
```

## Common Issues and Solutions

### Issue 1: "Error: Not authenticated"
```bash
# Solution: Login to Cloudflare
npx wrangler login
```

### Issue 2: "Error: KV namespace not found"
```bash
# Solution: Make sure you created KV namespaces and updated wrangler.toml
npx wrangler kv:namespace list

# Copy the IDs and update wrangler.toml
```

### Issue 3: "Error: R2 bucket not found"
```bash
# Solution: Create R2 bucket
npx wrangler r2 bucket create call-recordings-production

# Verify it was created
npx wrangler r2 bucket list
```

### Issue 4: "WebSocket connection failed"
```bash
# Solution: Check if worker is deployed
npx wrangler deployments list

# Check worker logs
npx wrangler tail
```

### Issue 5: "OpenAI API error"
```bash
# Solution: Verify your API key is set correctly
npx wrangler secret list

# If OPENAI_API_KEY is missing, set it
echo "your-api-key" | npx wrangler secret put OPENAI_API_KEY
```

## Next Steps

### 1. Monitor Your Deployment

```bash
# Watch real-time logs
npx wrangler tail

# View metrics
# Go to: https://dash.cloudflare.com/workers
```

### 2. Configure Custom Domain (Optional)

```bash
# Add route in wrangler.toml
routes = [
  { pattern = "calls.yourdomain.com", zone_name = "yourdomain.com" }
]

# Deploy
npx wrangler deploy
```

### 3. Deploy to Production

```bash
# When ready for production
npm run deploy:production
```

### 4. Enable Monitoring

Add to your Cloudflare dashboard:
- Enable Analytics Engine
- Set up alerts for error rate >5%
- Configure email notifications

### 5. Optimize for Your Use Case

Edit `src/index.ts` to adjust:
```typescript
const CONFIG = {
  MAX_CONCURRENT_CALLS_PER_WORKER: 10000,  // Adjust based on load
  RATE_LIMIT_PER_IP: 100,                  // Requests per minute
  WEBSOCKET_TIMEOUT: 300000,               // 5 minutes default
  OPENAI_TIMEOUT: 30000,                   // 30 seconds
};
```

## Performance Testing

### Test 1: Single Call Latency

```bash
# Measure WebSocket latency
time wscat -c wss://your-worker.workers.dev/ws/call-session
```

Target: <100ms connection time

### Test 2: Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test config
cat > load-test.yml << EOF
config:
  target: "https://your-worker.workers.dev"
  phases:
    - duration: 60
      arrivalRate: 100
scenarios:
  - name: "Health check"
    flow:
      - get:
          url: "/health"
EOF

# Run load test
artillery run load-test.yml
```

Target: <50ms average response time

### Test 3: WebSocket Stress Test

```bash
# Test concurrent WebSocket connections
# Use: https://github.com/websockets/ws

node -e "
const WebSocket = require('ws');
const connections = [];

for (let i = 0; i < 1000; i++) {
  const ws = new WebSocket('wss://your-worker.workers.dev/ws/call-session');
  ws.on('open', () => console.log('Connected:', i));
  connections.push(ws);
}
"
```

Target: 1000+ concurrent connections per worker

## Cost Estimation

### Development/Testing (< 1,000 calls/day)
- Cloudflare Workers: Free tier (100K requests/day)
- KV: Free tier (100K reads/day)
- R2: ~$1/month
- OpenAI: ~$50/month
- **Total: ~$51/month**

### Small Scale (10,000 concurrent calls)
- Cloudflare: ~$50/month
- FreeSWITCH: 2 servers × $80 = $160/month
- OpenAI: ~$400K/month (or $200/month with local models)
- **Total: ~$400K/month (or $410/month optimized)**

### Enterprise Scale (200,000 concurrent calls)
- Cloudflare: ~$1,500/month
- FreeSWITCH: 30 servers × $80 = $2,400/month
- OpenAI: ~$8.5M/month (or $4K/month with local models)
- **Total: ~$8.5M/month (or $8K/month optimized)**

**Recommendation**: Use local AI models (Whisper.cpp, Llama, Piper TTS) to reduce costs by 99%

## Support Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Durable Objects Guide**: https://developers.cloudflare.com/durable-objects/
- **OpenAI API Reference**: https://platform.openai.com/docs/
- **FreeSWITCH Wiki**: https://freeswitch.org/confluence/
- **Troubleshooting**: See ARCHITECTURE.md

## Production Checklist

Before going live with 200K calls:

- [ ] Deployed to production environment
- [ ] Custom domain configured
- [ ] Rate limiting tested and configured
- [ ] Error monitoring enabled
- [ ] Cost alerts configured
- [ ] FreeSWITCH cluster deployed (20-30 nodes)
- [ ] Kamailio load balancer configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented
- [ ] Security audit completed
- [ ] Load testing passed (200K+ concurrent)
- [ ] Latency optimized (<100ms average)
- [ ] OpenAI costs optimized (local models?)
- [ ] Team trained on monitoring dashboard
- [ ] On-call rotation established

## Congratulations!

Your enterprise-grade AI call handler is now deployed and ready to scale to 200,000+ concurrent calls!

For advanced configuration and optimization, see:
- **README.md**: Complete deployment guide
- **ARCHITECTURE.md**: Technical deep-dive
- **src/index.ts**: Main worker code
- **src/CallSessionDO.ts**: Call session management

Happy calling! 🚀
