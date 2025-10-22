# Copy-Paste Functions for Supabase Dashboard

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/functions

---

## ⚠️ Important: These functions are too complex for dashboard editor

The 3 edge functions have **400+ lines of code each** with WebSocket handling, which is too complex to paste into the Supabase dashboard editor.

### ✅ Best Option: Use Supabase CLI

You MUST use the Supabase CLI to deploy these functions. Here's why:

1. **ai-call-handler-azure** - 443 lines with WebSocket and real-time audio processing
2. **batch-call-v2** - 399 lines with concurrent call handling
3. **billplz-credits-topup** - 245 lines with payment webhooks

### 📋 Quick CLI Deploy (5 minutes)

**Option 1: Use NPX (No installation needed)**

```bash
# Navigate to your project
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"

# Login to Supabase
npx supabase login

# Deploy all 3 functions
npx supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
npx supabase functions deploy batch-call-v2 --project-ref ahexnoaazbveiyhplfrc
npx supabase functions deploy billplz-credits-topup --project-ref ahexnoaazbveiyhplfrc
```

**Option 2: Install Supabase CLI (Windows)**

```powershell
# Install Scoop (package manager)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Navigate to project and deploy
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"
supabase login
supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
supabase functions deploy batch-call-v2 --project-ref ahexnoaazbveiyhplfrc
supabase functions deploy billplz-credits-topup --project-ref ahexnoaazbveiyhplfrc
```

**Option 3: Download CLI Binary**

1. Download from: https://github.com/supabase/cli/releases/latest
2. Choose: `supabase_windows_amd64.zip`
3. Extract and add to PATH
4. Run the deploy commands above

---

## 🔑 After Deployment: Set Environment Variables

Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/settings/functions

Click "Show Keys" in your Azure portal screenshot and add:

```
AZURE_SPEECH_KEY=<your KEY 1>
AZURE_SPEECH_REGION=eastasia
OPENROUTER_API_KEY=<your key>
ELEVENLABS_API_KEY=<your key>
BILLPLZ_API_KEY=<your key>
BILLPLZ_COLLECTION_ID=<your collection id>
APP_ORIGIN=https://your-domain.com
```

---

## ✅ Verify Deployment

After deploying, you should see 3 new functions in your dashboard:

1. **ai-call-handler-azure** - Real-time WebSocket handler
2. **batch-call-v2** - Batch call initiator
3. **billplz-credits-topup** - Payment handler

Test URLs:
- https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/ai-call-handler-azure
- https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/batch-call-v2
- https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/billplz-credits-topup

---

## 🆘 If CLI Doesn't Work

If you absolutely cannot use CLI, here's a workaround:

### 1. Create Functions via Dashboard

Go to https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/functions

Create 3 empty functions with names:
- `ai-call-handler-azure`
- `batch-call-v2`
- `billplz-credits-topup`

### 2. Use GitHub Integration

1. Connect your GitHub repo to Supabase
2. Supabase will auto-deploy functions from `supabase/functions/` folder
3. Every git push will trigger auto-deployment

**To enable:**
- Go to: Settings → CI/CD
- Connect GitHub repository: `aqilrvsb/aicall`
- Enable auto-deploy for functions

This way, whenever you push to GitHub, functions auto-deploy! 🚀

---

## 📝 Summary

**Recommended:** Use `npx supabase` (no installation needed)

```bash
cd "c:\Users\aqilz\Downloads\aicallpro-up-main (1)\aicallpro-up-main"
npx supabase login
npx supabase functions deploy ai-call-handler-azure --project-ref ahexnoaazbveiyhplfrc
npx supabase functions deploy batch-call-v2 --project-ref ahexnoaazbveiyhplfrc
npx supabase functions deploy billplz-credits-topup --project-ref ahexnoaazbveiyhplfrc
```

**Then set environment variables** in the dashboard.

That's it! 🎉
