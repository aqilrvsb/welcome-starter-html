# 🔐 Remove Secrets from Git History - Complete Guide

**Status**: Secrets have been removed from current files, but still exist in Git history
**Action**: Follow ONE of the methods below to completely remove them

---

## ⚠️ IMPORTANT: Before You Start

1. **Backup your repository**:
   ```bash
   cd ..
   cp -r welcome-starter-html-master welcome-starter-html-master-BACKUP
   ```

2. **Coordinate with team**: If others have cloned this repo, they'll need to re-clone after you're done

3. **You MUST rotate API keys** even after removing from history (they may have been seen already)

---

## 🎯 METHOD 1: Use BFG Repo-Cleaner (EASIEST - RECOMMENDED)

### Step 1: Download BFG
Download from: https://rtyley.github.io/bfg-repo-cleaner/

```bash
# Download bfg.jar to your Downloads folder
```

### Step 2: Create secrets file
Create a file `secrets.txt` with the secrets to remove:

```txt
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
sk_74be6861daa232153faeaca94ed6e26783cdd6fecf3fa489
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I
```

### Step 3: Run BFG
```bash
cd C:\Users\aqilz\Documents\welcome-starter-html-master

# Replace secrets in all commits
java -jar C:\Users\aqilz\Downloads\bfg.jar --replace-text secrets.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 4: Force push
```bash
git push origin --force --all
git push origin --force --tags
```

### Step 5: Verify
```bash
# Should return nothing:
git log --all -S "sk-or-v1-ddb" --source
```

### Step 6: Delete secrets.txt
```bash
rm secrets.txt
```

---

## 🎯 METHOD 2: Make Repository Private (QUICKEST)

If your repository is currently public, the easiest solution is to make it private:

### Steps:
1. Go to GitHub repository settings
2. Scroll to "Danger Zone"
3. Click "Change visibility"
4. Select "Make private"
5. Rotate all API keys (they're still exposed to anyone who saw them while public)

**Pros**: Takes 30 seconds
**Cons**: Secrets still in history, but only you can see them

---

## 🎯 METHOD 3: Create Fresh Repository (NUCLEAR OPTION)

If you want a completely clean start:

### Steps:
1. Create a new empty repository on GitHub
2. Copy only the current working files (not .git folder):
   ```bash
   mkdir welcome-starter-html-CLEAN
   cd welcome-starter-html-master

   # Copy everything except .git
   xcopy /E /I /EXCLUDE:.git ..\welcome-starter-html-CLEAN
   ```

3. Initialize new Git repo:
   ```bash
   cd ..\welcome-starter-html-CLEAN
   git init
   git add .
   git commit -m "Initial commit - clean history"
   git branch -M master
   git remote add origin https://github.com/aqilrvsb/NEW-REPO-NAME.git
   git push -u origin master
   ```

4. Delete old repository on GitHub
5. Rotate all API keys

**Pros**: Completely clean history, no secrets anywhere
**Cons**: Lose all commit history

---

## ✅ After Cleaning History

### 1. Rotate ALL API Keys (MANDATORY!)

Even after removing from Git, the keys may have been exposed. You MUST rotate them:

**OpenRouter**:
1. Go to https://openrouter.ai/keys
2. Delete key: `sk-or-v1-ddb63feb...`
3. Create new key
4. Update in Deno Deploy secrets

**ElevenLabs**:
1. Go to https://elevenlabs.io/app/settings/api-keys
2. Delete key: `sk_74be6861daa...`
3. Create new key
4. Update in Deno Deploy secrets

**Supabase**:
1. Go to Supabase Dashboard → Settings → API
2. Click "Reset" on Service Role Key
3. Copy new key
4. Update in Deno Deploy secrets

### 2. Update Deno Deploy Secrets

```bash
# In Deno Deploy dashboard or CLI, update:
OPENROUTER_API_KEY=<new_key>
ELEVENLABS_API_KEY=<new_key>
SUPABASE_SERVICE_ROLE_KEY=<new_key>
```

### 3. Test System

After rotating keys, test your system to ensure everything works with new keys.

### 4. Set Spending Limits

On all services, set monthly spending limits to prevent abuse if keys are exposed again:
- OpenRouter: Set budget limits
- ElevenLabs: Set usage alerts
- Supabase: Enable billing alerts

---

## 🔍 Verify Secrets Are Gone

After using any method above, verify secrets are removed:

```bash
# Should return nothing for each:
git log --all -S "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" --source
git log --all -S "sk_74be6861daa232153faeaca94ed6e26783cdd6fecf3fa489" --source
git log --all -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I" --source
```

If these commands return no results, secrets are successfully removed!

---

## 📋 Checklist

- [ ] Choose a method (BFG / Private Repo / Fresh Repo)
- [ ] Execute chosen method
- [ ] Verify secrets are gone from history
- [ ] Rotate OpenRouter API key
- [ ] Rotate ElevenLabs API key
- [ ] Rotate Supabase Service Role key
- [ ] Update all deployment secrets with new keys
- [ ] Test system with new keys
- [ ] Set spending limits on all services
- [ ] Delete any local backups containing old keys

---

## ❓ Need Help?

If you're unsure which method to use:
- **Have team members?** → Use METHOD 1 (BFG)
- **Solo project, want quick fix?** → Use METHOD 2 (Make Private) + Rotate Keys
- **Want cleanest solution?** → Use METHOD 3 (Fresh Repo)

**My Recommendation**: METHOD 1 (BFG) is the most thorough while preserving your commit history.

---

## 🆘 If Keys Were Already Abused

If you notice unexpected charges or database changes:

1. **Immediately** revoke ALL exposed keys
2. Check billing dashboards for unauthorized usage
3. Review database audit logs in Supabase
4. Contact support if fraudulent activity detected
5. File disputes for any unauthorized charges

---

**Created**: 2025-10-27
**Status**: Secrets removed from current files, awaiting history cleanup
**Next Step**: Choose and execute ONE method above
