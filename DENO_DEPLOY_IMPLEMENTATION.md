# Deno Deploy Backend Implementation Guide

## Overview
This document explains how to implement the trial/pro account system in your Deno Deploy edge functions.

---

## 1. Dynamic SIP Configuration Based on Account Type

### Architecture:
- **Trial Account**: Uses **fixed/shared** FreeSWITCH SIP credentials (demo trunk for testing)
- **Pro Account**: Uses **user's own** SIP credentials from `phone_config` table (their AlienVOIP account)

### Implementation in Deno Deploy

```typescript
// File: deno-deploy/batch-call.ts or deno-deploy/make-call.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Fixed SIP credentials for trial accounts (shared FreeSWITCH trunk)
const TRIAL_SIP_CONFIG = {
  sip_username: 'trial_demo',        // Your fixed trial SIP username
  sip_password: 'trial_demo_pass',   // Your fixed trial SIP password
  sip_proxy_primary: 'sip1.alienvoip.com',
  sip_proxy_secondary: 'sip3.alienvoip.com',
  sip_caller_id: '+60123456789',     // Fixed caller ID for trial
  sip_display_name: 'Trial Call',
};

/**
 * Get SIP configuration based on user's account type
 */
async function getSipConfig(userId: string) {
  // 1. Get user's account type
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Error(`Failed to fetch user account type: ${userError.message}`);
  }

  const accountType = user?.account_type || 'trial';

  // 2. Return SIP config based on account type
  if (accountType === 'trial') {
    console.log(`[SIP Config] User ${userId} is on TRIAL account - using shared SIP trunk`);
    return {
      accountType: 'trial',
      sipConfig: TRIAL_SIP_CONFIG,
    };
  } else if (accountType === 'pro') {
    console.log(`[SIP Config] User ${userId} is on PRO account - fetching user's SIP credentials`);

    // Fetch user's own SIP credentials from phone_config
    const { data: phoneConfig, error: phoneError } = await supabase
      .from('phone_config')
      .select('sip_username, sip_password, sip_proxy_primary, sip_proxy_secondary, sip_caller_id, sip_display_name')
      .eq('user_id', userId)
      .single();

    if (phoneError || !phoneConfig) {
      throw new Error('Pro account requires SIP configuration. Please configure your SIP trunk in Settings.');
    }

    return {
      accountType: 'pro',
      sipConfig: {
        sip_username: phoneConfig.sip_username,
        sip_password: phoneConfig.sip_password,
        sip_proxy_primary: phoneConfig.sip_proxy_primary,
        sip_proxy_secondary: phoneConfig.sip_proxy_secondary || null,
        sip_caller_id: phoneConfig.sip_caller_id || null,
        sip_display_name: phoneConfig.sip_display_name || null,
      },
    };
  }

  throw new Error(`Unknown account type: ${accountType}`);
}

/**
 * Validate user balance before making call
 */
async function validateBalance(userId: string, estimatedMinutes: number) {
  const { data: user, error } = await supabase
    .from('users')
    .select('account_type, trial_minutes_total, trial_minutes_used, credits_balance')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('Failed to fetch user balance');
  }

  const accountType = user?.account_type || 'trial';

  if (accountType === 'trial') {
    const trialTotal = user?.trial_minutes_total || 10.0;
    const trialUsed = user?.trial_minutes_used || 0;
    const trialRemaining = trialTotal - trialUsed;

    if (trialRemaining <= 0) {
      throw new Error('Insufficient credits: Trial balance is 0. Please switch to Pro Account or top up credits.');
    }

    if (trialRemaining < estimatedMinutes) {
      throw new Error(
        `Insufficient credits: You have ${trialRemaining.toFixed(1)} trial minutes remaining but need approximately ${estimatedMinutes} minutes. Please switch to Pro Account or top up credits.`
      );
    }

    return { accountType: 'trial', balanceMinutes: trialRemaining };
  } else if (accountType === 'pro') {
    const creditsBalance = user?.credits_balance || 0;
    const balanceMinutes = creditsBalance / 0.15; // RM0.15 per minute
    const estimatedCost = estimatedMinutes * 0.15;

    if (creditsBalance <= 0) {
      throw new Error('Insufficient credits: Credits balance is RM0.00. Please top up credits.');
    }

    if (balanceMinutes < estimatedMinutes) {
      throw new Error(
        `Insufficient credits: You have ${balanceMinutes.toFixed(1)} minutes (RM${creditsBalance.toFixed(2)}) but need approximately ${estimatedMinutes} minutes (RM${estimatedCost.toFixed(2)}). Please top up credits.`
      );
    }

    return { accountType: 'pro', balanceMinutes, creditsBalance };
  }

  throw new Error(`Unknown account type: ${accountType}`);
}

/**
 * Deduct credits after call completes
 */
async function deductCreditsAfterCall(userId: string, callDurationMinutes: number) {
  // 1. Get user's current balance
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('account_type, trial_minutes_used, credits_balance, total_minutes_used')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('Failed to fetch user for credit deduction:', userError);
    return;
  }

  const accountType = user?.account_type || 'trial';

  // 2. Deduct based on account type
  if (accountType === 'trial') {
    console.log(`[Deduction] Trial account - deducting ${callDurationMinutes.toFixed(2)} minutes from trial_minutes_used`);

    const newTrialUsed = (user.trial_minutes_used || 0) + callDurationMinutes;
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        trial_minutes_used: newTrialUsed,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update trial minutes:', updateError);
    } else {
      console.log(`[Deduction] ✅ Trial minutes updated: ${newTrialUsed.toFixed(2)} used`);
    }
  } else if (accountType === 'pro') {
    const cost = callDurationMinutes * 0.15; // RM0.15 per minute
    const balanceBefore = user.credits_balance || 0;
    const balanceAfter = balanceBefore - cost;
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    console.log(`[Deduction] Pro account - deducting RM${cost.toFixed(2)} (${callDurationMinutes.toFixed(2)} minutes × RM0.15)`);

    // Update credits balance
    const { error: updateError } = await supabase
      .from('users')
      .update({
        credits_balance: balanceAfter,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update credits balance:', updateError);
      return;
    }

    // Log transaction
    const { error: transactionError } = await supabase
      .from('credits_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'usage',
        amount: -cost,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Call usage - ${callDurationMinutes.toFixed(2)} minutes @ RM0.15/min`,
      });

    if (transactionError) {
      console.error('Failed to log transaction:', transactionError);
    } else {
      console.log(`[Deduction] ✅ Credits updated: RM${balanceAfter.toFixed(2)} (deducted RM${cost.toFixed(2)})`);
    }
  }
}

/**
 * Example: Batch Call Handler
 */
export async function handleBatchCall(req: Request): Promise<Response> {
  try {
    const { userId, campaignName, promptId, phoneNumbers } = await req.json();

    // 1. Validate balance before proceeding
    const estimatedMinutes = phoneNumbers.length * 2; // 2 min per call estimate
    await validateBalance(userId, estimatedMinutes);

    // 2. Get SIP configuration based on account type
    const { accountType, sipConfig } = await getSipConfig(userId);

    console.log(`[Batch Call] Starting campaign for user ${userId} (${accountType})`);
    console.log(`[SIP Config] Using ${accountType === 'trial' ? 'shared trial trunk' : "user's own SIP trunk"}`);

    // 3. Make calls using the appropriate SIP configuration
    const results = [];
    for (const phoneNumber of phoneNumbers) {
      try {
        // Call FreeSWITCH with the dynamic SIP config
        const callResult = await makeFreeSwitchCall({
          phoneNumber,
          userId,
          promptId,
          sipUsername: sipConfig.sip_username,
          sipPassword: sipConfig.sip_password,
          sipProxy: sipConfig.sip_proxy_primary,
          callerId: sipConfig.sip_caller_id,
          displayName: sipConfig.sip_display_name,
        });

        results.push(callResult);

        // 4. After call completes, deduct credits
        if (callResult.success && callResult.duration) {
          await deductCreditsAfterCall(userId, callResult.duration);
        }
      } catch (callError) {
        console.error(`Failed to call ${phoneNumber}:`, callError);
        results.push({ phoneNumber, success: false, error: callError.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountType,
        summary: {
          total: phoneNumbers.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
        results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Batch call error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## 2. Summary: Trial vs Pro Account Logic

### **Trial Account**
- ✅ Uses **shared/fixed SIP trunk** (demo credentials)
- ✅ Validates **trial_minutes_used** < **trial_minutes_total** (10 minutes)
- ✅ Deducts from **trial_minutes_used** after each call
- ✅ No SIP configuration required from user
- ✅ Good for testing and onboarding

### **Pro Account**
- ✅ Uses **user's own SIP credentials** from `phone_config` table
- ✅ Validates **balance minutes** (credits_balance ÷ RM0.15) >= estimated minutes
- ✅ Deducts from **credits_balance** (RM0.15 per minute)
- ✅ Logs transaction in **credits_transactions** table
- ✅ Requires user to configure SIP trunk in Settings
- ✅ Production-ready for real business use

---

## 3. Testing Checklist

### Trial Account Testing:
1. ✅ New user registers → Should get `account_type='trial'`, `trial_minutes_total=10.0`
2. ✅ Make batch call → Should use fixed trial SIP credentials
3. ✅ After call completes → `trial_minutes_used` should increment
4. ✅ Try to make call when trial_minutes_used >= 10 → Should show error popup
5. ✅ Switch to Pro Account → `account_type` changes to 'pro'

### Pro Account Testing:
1. ✅ Configure SIP trunk in Settings → Save sip_username, sip_password
2. ✅ Top up RM50 → `credits_balance` = 50.00
3. ✅ Make batch call → Should use user's own SIP credentials from phone_config
4. ✅ After 5-minute call completes → `credits_balance` should decrease by RM0.75 (5 × 0.15)
5. ✅ Check Credits Top-Up page → Should show updated balance
6. ✅ Try call when balance_minutes < estimated → Should show error popup

---

## 4. Environment Variables Required

Add these to your Deno Deploy environment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FREESWITCH_URL=http://159.223.45.224
TRIAL_SIP_USERNAME=trial_demo
TRIAL_SIP_PASSWORD=trial_demo_pass
```

---

## 5. Next Steps

1. ✅ Update your Deno Deploy edge function with the code above
2. ✅ Test trial account flow end-to-end
3. ✅ Test pro account flow end-to-end
4. ✅ Monitor logs to ensure credit deduction works correctly
5. ✅ Deploy to production

---

**Generated with Claude Code** 🤖
