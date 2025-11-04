# Deploy Supabase Edge Functions

## Quick Deploy (3 Functions)

You need to deploy these 3 edge functions to make the Azure STT pipeline work:

1. **ai-call-handler-azure** - Main WebSocket handler with Azure STT
2. **batch-call-v2** - Initiates batch calls
3. **billplz-credits-topup** - Handles credit purchases

## Option 1: Using Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

**Windows (using Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or download the installer:**
https://github.com/supabase/cli/releases/latest

**Mac/Linux:**
```bash
brew install supabase/tap/supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```

This will open a browser window for authentication.

### Step 3: Deploy Functions

```bash
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"

# Deploy ai-call-handler-azure
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc

# Deploy batch-call-v2
supabase functions deploy batch-call-v2 --project-ref ahexnoaazbveiyhplfrc

# Deploy billplz-credits-topup
supabase functions deploy billplz-credits-topup --project-ref ahexnoaazbveiyhplfrc
```

### Step 4: Set Environment Variables

Go to [Supabase Dashboard → Functions → Secrets](https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions)

Add these secrets:
```
AZURE_SPEECH_KEY=<your Azure KEY 1>
AZURE_SPEECH_REGION=eastasia
OPENROUTER_API_KEY=<your OpenRouter key>
ELEVENLABS_API_KEY=<your ElevenLabs key>
BILLPLZ_API_KEY=<your Billplz key>
BILLPLZ_COLLECTION_ID=<your Billplz collection ID>
APP_ORIGIN=https://your-domain.com
```

### Step 5: Test

```bash
# Test ai-call-handler-azure
curl -L -X POST 'https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/ai-call-handler-azure' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDMwMjIsImV4cCI6MjA3NTgxOTAyMn0.VH_VZsEngYCHZDESJXnQpkGWWQpxSGs0JsdrDfwfLYw'

# Test batch-call-v2
curl -L -X POST 'https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/batch-call-v2' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDMwMjIsImV4cCI6MjA3NTgxOTAyMn0.VH_VZsEngYCHZDESJXnQpkGWWQpxSGs0JsdrDfwfLYw' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"test"}'

# Test billplz-credits-topup
curl -L -X POST 'https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/billplz-credits-topup' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDMwMjIsImV4cCI6MjA3NTgxOTAyMn0.VH_VZsEngYCHZDESJXnQpkGWWQpxSGs0JsdrDfwfLYw' \
  -H 'Content-Type: application/json' \
  -d '{"amount":50}'
```

## Option 2: Manual Deploy via Supabase Dashboard

If you prefer to deploy via the web interface:

### Step 1: Go to Edge Functions
https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/functions

### Step 2: Deploy Each Function

**For ai-call-handler-azure:**
1. Click "Deploy a new function"
2. Name: `ai-call-handler-azure`
3. Copy the code from: `supabase/functions/ai-call-handler-azure/index.ts`
4. Paste and deploy

**For batch-call-v2:**
1. Click "Deploy a new function"
2. Name: `batch-call-v2`
3. Copy the code from: `supabase/functions/batch-call-v2/index.ts`
4. Paste and deploy

**For billplz-credits-topup:**
1. Click "Deploy a new function"
2. Name: `billplz-credits-topup`
3. Copy the code from: `supabase/functions/billplz-credits-topup/index.ts`
4. Paste and deploy

### Step 3: Set Environment Variables

Go to: Functions → Secrets (see Step 4 in Option 1)

## Option 3: Deploy via GitHub Actions (Automated)

Create `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Supabase Functions

on:
  push:
    branches:
      - master
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Functions
        run: |
          supabase functions deploy ai-call-handler-azure --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase functions deploy batch-call-v2 --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase functions deploy billplz-credits-topup --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Add these secrets to your GitHub repository:
- `SUPABASE_PROJECT_REF`: `ahexnoaazbveiyhplfrc`
- `SUPABASE_ACCESS_TOKEN`: Get from https://supabase.com/dashboard/account/tokens

## Verify Deployment

After deployment, check:

1. **Functions are listed:**
   https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/functions

2. **Functions are accessible:**
   - ai-call-handler-azure: `https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/ai-call-handler-azure`
   - batch-call-v2: `https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/batch-call-v2`
   - billplz-credits-topup: `https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/billplz-credits-topup`

3. **View logs:**
   ```bash
   supabase functions logs ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc --follow
   ```

## Troubleshooting

### Function not found after deployment
- Wait 1-2 minutes for deployment to complete
- Check logs in Supabase Dashboard → Functions → Logs

### Environment variables not working
- Make sure they're added in Functions → Secrets (not Database Settings)
- Redeploy the function after adding secrets

### WebSocket connection failing
- Verify AZURE_SPEECH_KEY is set correctly
- Check Azure quota limits
- View logs: `supabase functions logs ai-call-handler-azure --follow`

## Next Steps

Once deployed:
1. ✅ Set environment variables in Supabase dashboard
2. ✅ Test credits top-up flow
3. ✅ Make a test call with 1 phone number
4. ✅ Verify cost tracking in `call_costs` table
5. ✅ Scale to production with real clients

---

**Your functions are now deployed!** Railway will automatically deploy the frontend when you push to GitHub.
