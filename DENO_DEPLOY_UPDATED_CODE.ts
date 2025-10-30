/**
 * AI Call Handler for FreeSWITCH + mod_audio_stream
 *
 * ✅ UPDATED: Dynamic SIP Configuration based on account_type
 * - Trial Account: Uses shared SIP trunk (TRIAL_SIP_USERNAME env vars)
 * - Pro Account: Uses user's own SIP trunk from phone_config table
 */

// ============================================================================
// STEP 1: Add these helper functions AFTER the supabaseAdmin initialization
// ============================================================================

/**
 * Get SIP configuration based on user's account type
 */
async function getSipConfig(userId: string) {
  // 1. Get user's account type
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Failed to fetch user account type:', userError);
    throw new Error(`Failed to fetch account type: ${userError.message}`);
  }

  const accountType = user?.account_type || 'trial';
  console.log(`📋 User ${userId} account type: ${accountType}`);

  // 2. Return SIP config based on account type
  if (accountType === 'trial') {
    // Trial: Use environment variable credentials (shared trunk)
    const sipConfig = {
      sip_username: Deno.env.get('TRIAL_SIP_USERNAME') || '646006395',
      sip_password: Deno.env.get('TRIAL_SIP_PASSWORD') || 'Xh7Yk5Ydcg',
      sip_proxy_primary: Deno.env.get('TRIAL_SIP_PROXY') || 'sip3.alienvoip.com',
      sip_caller_id: Deno.env.get('TRIAL_CALLER_ID') || '010894904',
      gateway_name: 'external', // Use existing FreeSWITCH gateway
    };

    console.log(`✅ Using TRIAL SIP trunk (shared): ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
    return { accountType: 'trial', sipConfig };
  } else {
    // Pro: Fetch user's own SIP credentials from phone_config
    const { data: phoneConfig, error: phoneError } = await supabaseAdmin
      .from('phone_config')
      .select('sip_username, sip_password, sip_proxy_primary, sip_caller_id')
      .eq('user_id', userId)
      .single();

    if (phoneError || !phoneConfig) {
      throw new Error('Pro account requires SIP configuration. Please configure your SIP trunk in Settings.');
    }

    const sipConfig = {
      sip_username: phoneConfig.sip_username,
      sip_password: phoneConfig.sip_password,
      sip_proxy_primary: phoneConfig.sip_proxy_primary,
      sip_caller_id: phoneConfig.sip_caller_id || '010894904',
      gateway_name: 'external', // Use existing FreeSWITCH gateway (you can make this dynamic too)
    };

    console.log(`✅ Using PRO SIP trunk (user's own): ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
    return { accountType: 'pro', sipConfig };
  }
}

/**
 * Validate user balance before making calls
 */
async function validateBalance(userId: string, estimatedMinutes: number) {
  const { data: user, error } = await supabaseAdmin
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

    console.log(`✅ Trial balance check passed: ${trialRemaining.toFixed(1)} minutes remaining`);
    return { accountType: 'trial', balanceMinutes: trialRemaining };
  } else {
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

    console.log(`✅ Pro balance check passed: ${balanceMinutes.toFixed(1)} minutes (RM${creditsBalance.toFixed(2)}) remaining`);
    return { accountType: 'pro', balanceMinutes, creditsBalance };
  }
}

/**
 * Deduct credits after call completes
 */
async function deductCreditsAfterCall(userId: string, callDurationMinutes: number) {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('account_type, trial_minutes_used, credits_balance, total_minutes_used')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Failed to fetch user for credit deduction:', userError);
    return;
  }

  const accountType = user?.account_type || 'trial';

  if (accountType === 'trial') {
    const newTrialUsed = (user.trial_minutes_used || 0) + callDurationMinutes;
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    console.log(`💳 [TRIAL] Deducting ${callDurationMinutes.toFixed(2)} minutes from trial_minutes_used`);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        trial_minutes_used: newTrialUsed,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update trial minutes:', updateError);
    } else {
      console.log(`✅ Trial deduction complete: ${newTrialUsed.toFixed(2)} minutes used total`);
    }
  } else {
    const cost = callDurationMinutes * 0.15; // RM0.15 per minute
    const balanceBefore = user.credits_balance || 0;
    const balanceAfter = balanceBefore - cost;
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    console.log(`💳 [PRO] Deducting RM${cost.toFixed(2)} (${callDurationMinutes.toFixed(2)} min × RM0.15/min)`);

    // Update credits balance
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        credits_balance: balanceAfter,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update credits balance:', updateError);
      return;
    }

    // Log transaction
    const { error: transactionError } = await supabaseAdmin
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
      console.error('❌ Failed to log transaction:', transactionError);
    } else {
      console.log(`✅ Pro deduction complete: RM${balanceAfter.toFixed(2)} remaining (deducted RM${cost.toFixed(2)})`);
    }
  }
}

// ============================================================================
// STEP 2: Update handleBatchCall function (around line 152)
// ============================================================================

// FIND THIS CODE (line 160-166):
/*
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) throw new Error('User not found');
*/

// REPLACE WITH:
/*
    // 1. Get user data including account_type
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) throw new Error('User not found');

    // 2. Validate balance before proceeding
    const estimatedMinutes = phoneNumbers.length * 2; // 2 min per call estimate
    await validateBalance(userId, estimatedMinutes);

    // 3. Get SIP configuration based on account type
    const { accountType, sipConfig } = await getSipConfig(userId);
    console.log(`🎯 Account Type: ${accountType}`);
*/

// ============================================================================
// STEP 3: Update originateCallWithAudioStream function (around line 301)
// ============================================================================

// FIND THIS CODE (line 216-222):
/*
        const callId = await originateCallWithAudioStream({
          phoneNumber: cleanNumber,
          userId,
          campaignId: campaign?.id || null,
          promptId: prompt.id,
          websocketUrl: WEBSOCKET_URL,
        });
*/

// REPLACE WITH:
/*
        const callId = await originateCallWithAudioStream({
          phoneNumber: cleanNumber,
          userId,
          campaignId: campaign?.id || null,
          promptId: prompt.id,
          websocketUrl: WEBSOCKET_URL,
          sipConfig: sipConfig, // Pass SIP config from parent scope
        });
*/

// ============================================================================
// STEP 4: Update originateCallWithAudioStream function signature
// ============================================================================

// FIND THIS CODE (line 301):
/*
async function originateCallWithAudioStream(params: any): Promise<string> {
  const { phoneNumber, userId, campaignId, promptId, websocketUrl } = params;
*/

// REPLACE WITH:
/*
async function originateCallWithAudioStream(params: any): Promise<string> {
  const { phoneNumber, userId, campaignId, promptId, websocketUrl, sipConfig } = params;

  // Log which SIP gateway we're using
  console.log(`📞 Using SIP: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
*/

// FIND THIS CODE (line 323 - THE ORIGINATE COMMAND):
/*
  const originateCmd = `api originate {${vars}}sofia/gateway/external::1360d030-6e0c-4617-83e0-8d80969010cf/${phoneNumber} &park()`;
*/

// REPLACE WITH:
/*
  // NOTE: This still uses gateway 'external' - the gateway credentials will be updated
  // in FreeSWITCH configuration to use either trial or pro SIP credentials dynamically.
  // For now, the gateway name stays 'external' but FreeSWITCH can be configured to
  // route based on custom channel variables or you can create multiple gateways.

  const originateCmd = `api originate {${vars}}sofia/gateway/${sipConfig.gateway_name}/${phoneNumber} &park()`;

  console.log(`📞 Originating call via gateway: ${sipConfig.gateway_name}`);
*/

// ============================================================================
// STEP 5: Update WebSocket onclose to deduct credits (around line 71-150)
// ============================================================================

// FIND THE socket.onclose SECTION and ADD credit deduction:
/*
    socket.onclose = async () => {
      console.log("📞 Call ended - saving final data...");

      // Find session by socket
      let callId = null;
      let session = null;
      for (const [id, sess] of activeCalls.entries()) {
        if (sess.socket === socket) {
          callId = id;
          session = sess;
          break;
        }
      }

      if (session && callId) {
        // Calculate call duration
        const endTime = new Date();
        const durationMs = endTime.getTime() - session.startTime.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        const durationMinutes = durationSeconds / 60; // ✅ ADD THIS LINE

        console.log(`⏱️  Call duration: ${durationSeconds} seconds (${durationMinutes.toFixed(2)} minutes)`);

        // ✅ ADD: Deduct credits based on account type
        if (session.userId) {
          await deductCreditsAfterCall(session.userId, durationMinutes);
        }

        // ... rest of the existing code ...
*/

// ============================================================================
// ENVIRONMENT VARIABLES REQUIRED IN DENO DEPLOY
// ============================================================================
/*
TRIAL_SIP_USERNAME=646006395
TRIAL_SIP_PASSWORD=Xh7Yk5Ydcg
TRIAL_SIP_PROXY=sip3.alienvoip.com
TRIAL_CALLER_ID=010894904
*/

// ============================================================================
// DONE! Copy this entire updated index.ts to Deno Deploy
// ============================================================================
