/**
 * AI Call Handler for FreeSWITCH + mod_audio_stream
 *
 * ARCHITECTURE (matches Twilio exactly):
 * 1. FreeSWITCH call → mod_audio_stream → WebSocket to this server
 * 2. Audio → Azure STT → GPT-4o-mini → ElevenLabs TTS
 * 3. Audio streams back to FreeSWITCH → Customer hears AI
 *
 * Same real-time bidirectional audio streaming as Twilio!
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master API Keys
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const FREESWITCH_HOST = Deno.env.get('FREESWITCH_HOST');
const FREESWITCH_ESL_PORT = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021');
const FREESWITCH_ESL_PASSWORD = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================================================
// SYSTEM SETTINGS - Load OpenRouter Model from database
// ============================================================================

interface SystemSettings {
  openrouterModel: string; // e.g., 'openai/gpt-4o-mini'
}

// Cache for system settings (refreshed every 5 minutes)
let systemSettingsCache: SystemSettings | null = null;
let systemSettingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();

  // Return cached settings if still valid
  if (systemSettingsCache && (now - systemSettingsCacheTime) < SETTINGS_CACHE_TTL) {
    return systemSettingsCache;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'openrouter_model')
      .single();

    if (error) {
      console.error('❌ Failed to load system settings:', error);
      // Return default on error
      return {
        openrouterModel: 'openai/gpt-4o-mini'
      };
    }

    const settings: SystemSettings = {
      openrouterModel: data?.setting_value || 'openai/gpt-4o-mini'
    };

    // Update cache
    systemSettingsCache = settings;
    systemSettingsCacheTime = now;

    console.log(`⚙️  System Settings Loaded: Model=${settings.openrouterModel}`);

    return settings;
  } catch (err) {
    console.error('❌ Error loading system settings:', err);
    // Return default on error
    return {
      openrouterModel: 'openai/gpt-4o-mini'
    };
  }
}

// ============================================================================
// TRIAL/PRO ACCOUNT SYSTEM - Helper Functions
// ============================================================================

/**
 * Get SIP configuration based on user's account type
 */
async function getSipConfig(userId: string) {
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

  if (accountType === 'trial') {
    // Trial: Use environment variable credentials (shared trunk)
    const sipConfig = {
      sip_username: Deno.env.get('TRIAL_SIP_USERNAME') || '646006395',
      sip_password: Deno.env.get('TRIAL_SIP_PASSWORD') || 'Xh7Yk5Ydcg',
      sip_proxy_primary: Deno.env.get('TRIAL_SIP_PROXY') || 'sip3.alienvoip.com',
      sip_caller_id: Deno.env.get('TRIAL_CALLER_ID') || '010894904',
      gateway_name: 'external::1360d030-6e0c-4617-83e0-8d80969010cf',
    };

    console.log(`✅ TRIAL SIP: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
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
      gateway_name: 'external::1360d030-6e0c-4617-83e0-8d80969010cf',
    };

    console.log(`✅ PRO SIP: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
    return { accountType: 'pro', sipConfig };
  }
}

/**
 * Validate user balance before making calls
 */
async function validateBalance(userId: string, estimatedMinutes: number) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('account_type, trial_balance_minutes, pro_balance_minutes')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Failed to fetch user balance');

  const accountType = user?.account_type || 'trial';

  if (accountType === 'trial') {
    const trialBalance = user?.trial_balance_minutes || 0;

    if (trialBalance <= 0) {
      throw new Error('Insufficient credits: Trial balance is 0. Please switch to Pro Account or top up credits.');
    }

    if (trialBalance < estimatedMinutes) {
      throw new Error(
        `Insufficient credits: You have ${trialBalance.toFixed(1)} trial minutes but need ~${estimatedMinutes} min. Switch to Pro or top up.`
      );
    }

    console.log(`✅ Trial balance: ${trialBalance.toFixed(1)} min remaining`);
    return { accountType: 'trial', balanceMinutes: trialBalance };
  } else {
    const proBalance = user?.pro_balance_minutes || 0;

    if (proBalance <= 0) {
      throw new Error('Insufficient credits: Pro balance is 0 minutes. Please top up credits.');
    }

    if (proBalance < estimatedMinutes) {
      throw new Error(
        `Insufficient credits: You have ${proBalance.toFixed(1)} min but need ~${estimatedMinutes} min. Please top up.`
      );
    }

    console.log(`✅ Pro balance: ${proBalance.toFixed(1)} min`);
    return { accountType: 'pro', balanceMinutes: proBalance };
  }
}

/**
 * Deduct credits after call completes
 */
async function deductCreditsAfterCall(userId: string, callDurationMinutes: number) {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('account_type, trial_balance_minutes, pro_balance_minutes, total_minutes_used')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Failed to fetch user for credit deduction:', userError);
    return;
  }

  const accountType = user?.account_type || 'trial';

  if (accountType === 'trial') {
    const currentBalance = user.trial_balance_minutes || 0;
    const newBalance = Math.max(0, currentBalance - callDurationMinutes); // Don't go negative
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    console.log(`💳 [TRIAL] Deducting ${callDurationMinutes.toFixed(2)} min from ${currentBalance.toFixed(2)} min`);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        trial_balance_minutes: newBalance,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update trial balance:', updateError);
    } else {
      console.log(`✅ Trial: ${newBalance.toFixed(2)} min remaining (${callDurationMinutes.toFixed(2)} min deducted)`);
    }
  } else {
    const currentBalance = user.pro_balance_minutes || 0;
    const newBalance = Math.max(0, currentBalance - callDurationMinutes); // Don't go negative
    const newTotalUsed = (user.total_minutes_used || 0) + callDurationMinutes;

    console.log(`💳 [PRO] Deducting ${callDurationMinutes.toFixed(2)} min from ${currentBalance.toFixed(2)} min`);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        pro_balance_minutes: newBalance,
        total_minutes_used: newTotalUsed,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update pro balance:', updateError);
    } else {
      console.log(`✅ Pro: ${newBalance.toFixed(2)} min remaining (${callDurationMinutes.toFixed(2)} min deducted)`);
    }
  }
}

// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Batch call endpoint
  if (url.pathname === '/batch-call' && req.method === 'POST') {
    return handleBatchCall(req);
  }

  // WebSocket endpoint for mod_audio_stream (SAME AS TWILIO!)
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log("🎤 FreeSWITCH audio WebSocket connected!");
    };

    socket.onmessage = async (event) => {
      try {
        // mod_audio_stream sends audio as binary or JSON metadata
        if (typeof event.data === 'string') {
          const metadata = JSON.parse(event.data);
          console.log('📋 Metadata:', metadata);
          await handleCallStart(socket, metadata);
        } else {
          // Binary audio data (16-bit PCM from mod_audio_stream)
          await handleMediaStream(socket, event.data);
        }
      } catch (error) {
        console.error("❌ Error:", error);
      }
    };

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
        // ⏱️ Calculate call duration
        const endTime = new Date();
        const durationMs = endTime.getTime() - session.startTime.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        const durationMinutes = durationSeconds / 60; // Minutes for credit deduction

        console.log(`⏱️  Call duration: ${durationSeconds} seconds (${durationMinutes.toFixed(2)} minutes)`);

        // 📝 Format transcript as readable text
        const transcriptText = session.transcript
          .map((entry: any) => {
            const speaker = entry.speaker === 'assistant' ? 'AI' : 'Customer';
            return `[${speaker}]: ${entry.text}`;
          })
          .join('\n\n');

        // 💰 Calculate cost (RM 0.15 per minute)
        const cost = durationMinutes * 0.15;

        console.log(`💰 Cost: RM ${cost.toFixed(2)} (${durationMinutes} minute(s))`);

        // 🎙️ Recording URL (get from session metadata where it was set during call origination)
        const recordingUrl = session.recordingUrl || null;

        if (recordingUrl) {
          console.log(`🎙️ Recording URL: ${recordingUrl}`);
        } else {
          console.log(`⚠️ No recording URL found in session`);
        }

        // Save to database
        try {
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update({
              duration: durationSeconds,
              transcript: transcriptText,
              cost: cost,
              recording_url: recordingUrl, // Save recording URL for playback
            })
            .eq('call_id', callId);

          if (error) {
            console.error(`❌ Failed to save final call data:`, error);
          } else {
            console.log(`✅ Call data saved: duration=${durationSeconds}s, cost=RM${cost.toFixed(2)}, recording=${recordingUrl}`);
          }
        } catch (err) {
          console.error(`❌ Database error:`, err);
        }

        // ✅ DEDUCT CREDITS based on account type
        if (session.userId && durationMinutes > 0) {
          await deductCreditsAfterCall(session.userId, durationMinutes);
        }

        // Clean up session
        activeCalls.delete(callId);
        console.log(`🧹 Session ${callId} cleaned up`);
      }
    };

    return response;
  }

  return new Response('FreeSWITCH AI Handler - Use WebSocket or POST /batch-call', { status: 200 });
});

// Store active call sessions
const activeCalls = new Map();

async function handleBatchCall(req: Request): Promise<Response> {
  try {
    // 🎯 SIMPLIFIED: Frontend handles campaign creation, backend just receives campaignId
    const { userId, campaignId, promptId, phoneNumbers, phoneNumbersWithNames } = await req.json();

    if (!userId || !phoneNumbers) {
      throw new Error('Missing userId or phoneNumbers');
    }

    console.log(`📞 Batch call request: ${phoneNumbers.length} numbers${campaignId ? ` for campaign ${campaignId}` : ' (no campaign)'}`);

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) throw new Error('User not found');

    // ✅ VALIDATE BALANCE before proceeding
    const estimatedMinutes = phoneNumbers.length * 2; // 2 min per call estimate
    await validateBalance(userId, estimatedMinutes);

    // ✅ GET SIP CONFIGURATION based on account type
    const { accountType, sipConfig } = await getSipConfig(userId);
    console.log(`🎯 Account: ${accountType} | SIP: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);

    // Get prompt
    const { data: prompt } = await supabaseAdmin
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .eq('user_id', userId)
      .single();

    if (!prompt) throw new Error('Prompt not found');

    const WEBSOCKET_URL = `wss://${req.headers.get('host')}`;

    // Process calls
    const results = await Promise.all(phoneNumbers.map(async (phoneNumber: string) => {
      try {
        // Clean phone number: Remove non-digits, then handle Malaysian format
        let cleanNumber = phoneNumber.replace(/\D/g, '');

        // Convert +60XXXXXXXXX or 60XXXXXXXXX to 0XXXXXXXXX (Malaysian format)
        if (cleanNumber.startsWith('60') && cleanNumber.length >= 10) {
          cleanNumber = '0' + cleanNumber.substring(2);
        }
        const callId = await originateCallWithAudioStream({
          phoneNumber: cleanNumber,
          userId,
          campaignId: campaignId || null, // Use campaignId directly from request
          promptId: prompt.id,
          websocketUrl: WEBSOCKET_URL,
          sipConfig: sipConfig, // ✅ Pass SIP config
        });

        // 🎯 Extract first stage from prompt for initial stage_reached value
        const stageRegex = /!!Stage\s+([^!]+)!!/;
        const firstStageMatch = prompt.system_prompt?.match(stageRegex);
        const initialStage = firstStageMatch ? firstStageMatch[1].trim() : null;

        // 📇 Look up contact by phone number to get contact_id for variable replacement
        // Try to match with both cleaned number and original number
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .or(`phone_number.eq.${cleanNumber},phone_number.eq.${phoneNumber}`)
          .eq('user_id', userId)
          .maybeSingle();

        const { error: insertError } = await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaignId || null, // Use campaignId directly from request
          user_id: userId,
          call_id: callId,
          phone_number: cleanNumber, // Store normalized number
          caller_number: cleanNumber, // Required field
          agent_id: promptId, // Use prompt ID as agent identifier
          prompt_id: promptId, // Direct reference to prompt (required for optional campaigns)
          start_time: new Date().toISOString(), // Required field
          contact_id: contact?.id || null, // Link to contact if found
          status: 'initiated',
          stage_reached: initialStage, // Set initial stage from prompt
        });

        if (insertError) {
          console.error('❌ Failed to create call log:', insertError);
          throw new Error(`Failed to create call log: ${insertError.message}`);
        }

        return { success: true, phoneNumber, callId };
      } catch (error) {
        console.error(`❌ Failed to call ${phoneNumber}:`, error);
        return { success: false, phoneNumber, error: String(error) };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // Backend doesn't update campaign stats - frontend already did that
    console.log(`✅ Batch call complete: ${successCount} successful, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaignId || null,
      summary: {
        total: phoneNumbers.length,
        successful: successCount,
        failed: failedCount
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Originate call via FreeSWITCH ESL with mod_audio_stream
 */
async function originateCallWithAudioStream(params: any): Promise<string> {
  const { phoneNumber, userId, campaignId, promptId, websocketUrl, sipConfig } = params;

  // ✅ Log which SIP configuration we're using
  console.log(`📞 SIP Gateway: ${sipConfig.gateway_name} | User: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);

  // ⚠️ Check if FREESWITCH_HOST is configured
  if (!FREESWITCH_HOST) {
    console.error('❌ CRITICAL: FREESWITCH_HOST environment variable is not set!');
    throw new Error('FREESWITCH_HOST not configured in Deno Deploy environment variables');
  }

  console.log(`🔌 Connecting to FreeSWITCH at ${FREESWITCH_HOST}:${FREESWITCH_ESL_PORT}...`);

  try {
    const conn = await Deno.connect({
      hostname: FREESWITCH_HOST,
      port: FREESWITCH_ESL_PORT,
    });
    console.log(`✅ Connected to FreeSWITCH successfully!`);

  // 🎯 DETECT ACTUAL SERVER: Get the real server IP we connected to
  // When FREESWITCH_HOST is load balancer (144.126.243.181), this detects if we connected to 159.223.45.224 or 159.223.65.33
  const actualServerIP = (conn.remoteAddr as Deno.NetAddr).hostname;
  console.log(`🔍 Connected to FreeSWITCH: ${actualServerIP} (via ${FREESWITCH_HOST})`);

  // Authenticate
  await readESLResponse(conn);
  await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
  await readESLResponse(conn);

  // Build originate command - first originate and park, then start audio_stream
  const vars = [
    `user_id=${userId}`,
    `campaign_id=${campaignId}`,
    `prompt_id=${promptId}`,
    `origination_caller_id_number=${phoneNumber}`,
  ].join(',');

  // ✅ Use the actual SIP gateway from sipConfig
  // Gateway name format: "external::1360d030-6e0c-4617-83e0-8d80969010cf"
  const gatewayName = sipConfig.gateway_name || 'external::1360d030-6e0c-4617-83e0-8d80969010cf';

  // Originate and park the call first
  const originateCmd = `api originate {${vars}}sofia/gateway/${gatewayName}/${phoneNumber} &park()`;

  console.log(`📞 Originating: ${originateCmd}`);

  await sendESLCommand(conn, originateCmd);
  const response = await readESLResponse(conn);

  console.log(`📋 Originate Response: ${response}`);

  const uuidMatch = response.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  if (!uuidMatch) {
    conn.close();
    throw new Error('Failed to extract call UUID from response');
  }

  const callId = uuidMatch[1];
  console.log(`✅ Call UUID: ${callId}`);

  // Prepare recording filename (will be started when customer answers)
  const recordingFilename = `${callId}_${Date.now()}.wav`;
  const recordingPath = `/usr/local/freeswitch/recordings/${recordingFilename}`;
  // ✅ Use the ACTUAL server IP that handled the call, not load balancer IP
  // This ensures client can retrieve recording from the correct server
  const recordingUrl = `https://${actualServerIP}/recordings/${recordingFilename}`;

  // Now start audio streaming on the parked call
  // uuid_audio_stream <uuid> start <wss-url> [mono|mixed|stereo] [8000|16000] [metadata]
  // Build metadata JSON - only include campaign_id if it exists
  const metadataObj: any = {
    call_id: callId,
    user_id: userId,
    prompt_id: promptId,
    recording_url: recordingUrl,
    recording_path: recordingPath, // Pass recording path to start later when answered
  };

  if (campaignId) {
    metadataObj.campaign_id = campaignId;
  }

  const metadata = JSON.stringify(metadataObj);

  const audioStreamCmd = `api uuid_audio_stream ${callId} start ${websocketUrl} mono 8000 ${metadata}`;

  console.log(`🎤 Starting audio stream: ${audioStreamCmd}`);

  await sendESLCommand(conn, audioStreamCmd);
  const streamResponse = await readESLResponse(conn);

  console.log(`📋 Audio stream Response: ${streamResponse}`);

  // DON'T start monitoring here - will be in different Deno isolate!
  // WebSocket handler will start monitoring when it connects

  conn.close();

  return callId;

  } catch (error) {
    console.error(`❌ Failed to originate call to ${phoneNumber}:`, error);
    console.error(`❌ FreeSWITCH connection details: ${FREESWITCH_HOST}:${FREESWITCH_ESL_PORT}`);
    throw new Error(`Failed to originate call: ${error.message}`);
  }
}

/**
 * Monitor for CHANNEL_ANSWER and CHANNEL_HANGUP events
 * 📊 STATUS TRACKING: Updates call status based on hangup cause
 */
async function monitorCallAnswerEvent(callId: string, websocketUrl: string) {
  try {
    const conn = await Deno.connect({
      hostname: FREESWITCH_HOST,
      port: FREESWITCH_ESL_PORT,
    });

    await readESLResponse(conn);
    await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
    await readESLResponse(conn);

    // Subscribe to both ANSWER and HANGUP events for this specific call
    await sendESLCommand(conn, `filter Unique-ID ${callId}`);
    await readESLResponse(conn);

    await sendESLCommand(conn, `event CHANNEL_ANSWER CHANNEL_HANGUP`);
    await readESLResponse(conn);

    console.log(`👂 Monitoring call ${callId} for ANSWER/HANGUP events...`);

    // Wait for events (non-blocking)
    let keepMonitoring = true;
    while (keepMonitoring) {
      const event = await readESLResponse(conn);

      if (event.includes('CHANNEL_ANSWER')) {
        console.log(`✅ Call ${callId} ANSWERED by customer!`);

        // Wait for session to be created (race condition fix)
        let session = activeCalls.get(callId);
        let retries = 0;
        const maxRetries = 30; // Wait up to 3 seconds (30 x 100ms)

        while (!session && retries < maxRetries) {
          console.log(`⏳ Waiting for session ${callId} to be created... (${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
          session = activeCalls.get(callId);
          retries++;
        }

        if (session && !session.hasGreeted) {
          session.isCallAnswered = true;

          // 🎙️ Start recording now that customer has answered
          if (session.recordingPath) {
            try {
              const recordConn = await Deno.connect({
                hostname: FREESWITCH_HOST,
                port: FREESWITCH_ESL_PORT,
              });

              await readESLResponse(recordConn);
              await sendESLCommand(recordConn, `auth ${FREESWITCH_ESL_PASSWORD}`);
              await readESLResponse(recordConn);

              const recordCmd = `api uuid_record ${callId} start ${session.recordingPath}`;
              console.log(`🎙️ Starting recording (customer answered): ${recordCmd}`);

              await sendESLCommand(recordConn, recordCmd);
              const recordResponse = await readESLResponse(recordConn);
              console.log(`📋 Recording Response: ${recordResponse}`);

              recordConn.close();
            } catch (recordError) {
              console.error(`❌ Failed to start recording:`, recordError);
            }
          } else {
            console.log(`⚠️ No recording path found in session`);
          }

          // 📊 Update status to "answered"
          await updateCallStatus(callId, 'answered');

          console.log(`📞 Triggering greeting for ${callId}...`);
          // Let AI generate first message from system prompt
          await getAIResponse(session, "[START_CALL]");
          session.hasGreeted = true;
        } else if (!session) {
          console.error(`❌ Session ${callId} not found in activeCalls after ${maxRetries} retries!`);
        }
      }

      if (event.includes('CHANNEL_HANGUP')) {
        console.log(`📞 Call ${callId} HANGUP detected`);

        // Extract hangup cause from event
        const causeMatch = event.match(/Hangup-Cause:\s*(\w+)/i);
        const hangupCause = causeMatch ? causeMatch[1] : 'UNKNOWN';
        console.log(`📊 Hangup cause: ${hangupCause}`);

        // 📊 Determine status based on hangup cause
        let status = 'failed';

        if (hangupCause === 'NORMAL_CLEARING' || hangupCause === 'ORIGINATOR_CANCEL') {
          const session = activeCalls.get(callId);
          if (session && session.isCallAnswered) {
            status = 'answered'; // Call was answered successfully
          } else {
            status = 'no_answered'; // Customer declined or didn't pick up
          }
        } else if (hangupCause === 'NO_ANSWER' || hangupCause === 'USER_NOT_REGISTERED') {
          status = 'no_answered';
        } else if (hangupCause === 'CALL_REJECTED' || hangupCause === 'USER_BUSY') {
          status = 'no_answered';
        } else if (hangupCause === 'NO_USER_RESPONSE' || hangupCause === 'RECOVERY_ON_TIMER_EXPIRE') {
          status = 'voicemail'; // Likely went to voicemail
        } else if (hangupCause === 'INVALID_NUMBER_FORMAT' || hangupCause === 'UNALLOCATED_NUMBER') {
          status = 'failed';
        }

        console.log(`📊 Final status: ${status}`);
        await updateCallStatus(callId, status);

        keepMonitoring = false;
      }
    }

    conn.close();
  } catch (error) {
    console.error(`❌ Error monitoring call ${callId}:`, error);
  }
}

/**
 * 📊 Update call status in database
 */
async function updateCallStatus(callId: string, status: string) {
  try {
    const { error } = await supabaseAdmin
      .from('call_logs')
      .update({ status: status })
      .eq('call_id', callId);

    if (error) {
      console.error(`❌ Failed to update status to "${status}":`, error);
    } else {
      console.log(`✅ Status updated to "${status}" in database`);
    }
  } catch (err) {
    console.error(`❌ Database error updating status:`, err);
  }
}

async function handleCallStart(socket: WebSocket, metadata: any) {
  const callId = metadata.call_id || metadata.uuid || 'unknown';
  const userId = metadata.user_id || '';
  const campaignId = metadata.campaign_id || '';
  const promptId = metadata.prompt_id || '';
  const recordingUrl = metadata.recording_url || null;
  const recordingPath = metadata.recording_path || null;

  console.log(`📞 Call started: ${callId}`);
  if (recordingUrl) {
    console.log(`🎙️ Recording will be saved to: ${recordingUrl}`);
  }

  // Load system settings (OpenRouter model)
  const systemSettings = await getSystemSettings();
  console.log(`⚙️  Using OpenRouter Model: ${systemSettings.openrouterModel}`);

  // Fetch voice config and prompts (same as Twilio code)
  let voiceId = "UcqZLa941Kkt8ZhEEybf";
  let voiceSpeed = 1.5;
  let systemPrompt = "You are a helpful AI assistant.";

  if (userId) {
    const { data: voiceConfig } = await supabaseAdmin
      .from('voice_config')
      .select('manual_voice_id, speed')
      .eq('user_id', userId)
      .maybeSingle();

    if (voiceConfig) {
      voiceId = voiceConfig.manual_voice_id || voiceId;
      voiceSpeed = voiceConfig.speed || voiceSpeed;
    }
  }

  // Fetch contact data for variable replacement
  let contactData = {
    name: '',
    phone: '',
    product: '',
    info: ''
  };

  if (callId) {
    const { data: callLog } = await supabaseAdmin
      .from('call_logs')
      .select('contact_id, phone_number')
      .eq('call_id', callId)
      .maybeSingle();

    if (callLog?.contact_id) {
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('name, phone_number, product, info')
        .eq('id', callLog.contact_id)
        .maybeSingle();

      if (contact) {
        contactData = {
          name: contact.name || '',
          phone: contact.phone_number || callLog.phone_number || '',
          product: contact.product || '',
          info: contact.info || ''
        };
      }
    } else if (callLog?.phone_number) {
      // If no contact_id, just use phone number from call_logs
      contactData.phone = callLog.phone_number;
    }
  }

  console.log(`📝 Contact data for variables:`, contactData);

  if (promptId && userId) {
    const { data: promptData } = await supabaseAdmin
      .from('prompts')
      .select('system_prompt')
      .eq('id', promptId)
      .eq('user_id', userId)
      .single();

    if (promptData) {
      // Replace variables with contact data
      systemPrompt = promptData.system_prompt
        .replace(/\{\{name\}\}/g, contactData.name)
        .replace(/\{\{phone\}\}/g, contactData.phone)
        .replace(/\{\{product\}\}/g, contactData.product)
        .replace(/\{\{info\}\}/g, contactData.info);

      console.log(`✅ Variables replaced in system prompt`);
    }
  }

  // 🎯 STAGE DETECTION: Parse all stages from system prompt
  // Extract all !!Stage [Name]!! markers from the prompt
  const stageRegex = /!!Stage\s+([^!]+)!!/g;
  const stages: string[] = [];
  let match;
  while ((match = stageRegex.exec(systemPrompt)) !== null) {
    stages.push(match[1].trim());
  }
  console.log(`📊 Detected ${stages.length} stages from prompt:`, stages);

  // 🤖 AUTO-INJECT STAGE TRACKING INSTRUCTIONS
  // If user's prompt contains stage markers, automatically inject tracking rules
  if (stages.length > 0) {
    const trackingRules = `
⚠️⚠️⚠️ CRITICAL SYSTEM INSTRUCTIONS - FAILURE TO FOLLOW WILL BREAK THE SYSTEM ⚠️⚠️⚠️

YOU MUST FOLLOW THESE RULES IN EVERY SINGLE RESPONSE WITHOUT EXCEPTION:

1. 🚨 MANDATORY STAGE MARKER 🚨
   - EVERY response MUST start with: !!Stage [stage name]!!
   - NO EXCEPTIONS - include this in EVERY response
   - Format: !!Stage Welcome Message!! or !!Stage Introduction!! or !!Stage Fact Finding!! etc.
   - The marker is invisible to the customer - it's for backend tracking
   - If you forget the marker, the system will break

   Available stages (use EXACTLY these names):
   ${stages.map(s => `   - !!Stage ${s}!!`).join('\n')}

2. 📝 DETAILS CAPTURE:
   - When collecting ALL customer details (package, price, address), wrap EVERYTHING in %% markers
   - IMPORTANT: Use opening %% and closing %% to wrap all details
   - Format: %%Pakej: [package]\nHarga: [price]\nAlamat: [full address]%%
   - Example:
     %%Pakej: 2 Botol
     Harga: RM100
     Alamat: No 123, Jalan Sultan, Kampung Baru%%
   - The details between %% will be saved to database automatically

3. 🛑 END CALL - MANDATORY:
   - When conversation ends, MUST add [end_call] keyword at the end
   - Format: "Terima kasih! [end_call]"
   - Without [end_call], the call will NOT terminate
   - Example: "Sekejap lagi admin akan whatsapp cik. Terima kasih! [end_call]"

❗ REMINDER: Start EVERY response with !!Stage [name]!! - Don't forget!

NOW FOLLOW THE USER'S PROMPT BELOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

    // Prepend tracking rules to system prompt
    systemPrompt = trackingRules + systemPrompt;
    console.log(`🤖 Auto-injected aggressive stage tracking rules for ${stages.length} stages`);
  }

  // Initialize session (SAME AS TWILIO!)
  const session = {
    callId,
    userId,
    campaignId,
    systemPrompt,
    voiceId,
    voiceSpeed,
    socket,
    startTime: new Date(),
    transcript: [],
    conversationHistory: [{ role: 'system', content: systemPrompt }],
    audioBuffer: [],
    isProcessingAudio: false,
    isSpeaking: false,
    isCallAnswered: false, // Track if customer has answered
    hasGreeted: false, // Track if we've sent first message
    lastAudioActivityTime: Date.now(), // Track silence detection
    costs: { azure_stt: 0, llm: 0, tts: 0 },
    audioFileCounter: 0, // Track temp file numbers for playback
    recordingUrl: recordingUrl, // Store recording URL from metadata
    recordingPath: recordingPath, // Store recording path to start recording when answered
    // 🎯 STAGE TRACKING
    stages: stages, // All available stages from prompt
    currentStage: stages.length > 0 ? stages[0] : null, // Start with first stage
    promptId: promptId, // Store for database updates
    // 🚀 GREEDY INFERENCE - AI request tracking
    greedyAI: {
      controller: null as AbortController | null,  // For cancellation
      promise: null as Promise<any> | null,        // Current AI request
      partialTranscript: '',                       // Building transcript
      isActive: false                              // Is greedy mode active
    },
    // ⚙️ SYSTEM SETTINGS - OpenRouter model
    systemSettings: systemSettings
  };

  activeCalls.set(callId, session);

  // Start monitoring for CHANNEL_ANSWER event IN THIS ISOLATE
  // This ensures monitorCallAnswerEvent() has access to the session we just created
  console.log("⏳ Waiting for customer to pick up call...");
  monitorCallAnswerEvent(callId, "");
}

async function handleMediaStream(socket: WebSocket, audioData: ArrayBuffer) {
  // Find session
  let session = null;
  for (const [_, sess] of activeCalls.entries()) {
    if (sess.socket === socket) {
      session = sess;
      break;
    }
  }

  if (!session) return;

  // Don't process audio until call is answered (ESL event will trigger greeting)
  if (!session.isCallAnswered) {
    return; // Silently discard audio until customer picks up
  }

  // CRITICAL: Don't process audio while AI is speaking to avoid interruptions
  if (session.isSpeaking || session.isProcessingAudio) {
    // Discard audio during AI speech for smooth transitions
    return;
  }

  // Convert to Uint8Array (mod_audio_stream sends L16/PCM)
  const pcmData = new Uint8Array(audioData);

  // Detect if this chunk contains silence
  // Convert to 16-bit samples for analysis
  const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  const isSilent = rms < 500; // Silence threshold (adjust if needed)

  session.audioBuffer.push(pcmData);

  // Track last audio activity time
  if (!isSilent) {
    session.lastAudioActivityTime = Date.now();
  }

  // 🎯 SMART ENDPOINTING: Dynamic timeout based on audio length
  const totalSize = session.audioBuffer.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  const timeSinceLastActivity = Date.now() - (session.lastAudioActivityTime || Date.now());
  const hasMinimumAudio = totalSize >= 16000; // At least 1 second of audio

  // Calculate dynamic timeout based on audio buffer size (proxy for response length)
  // 8000 samples/sec * 2 bytes/sample = 16000 bytes/sec
  const estimatedSeconds = totalSize / 16000;
  let requiredSilence: number;

  if (estimatedSeconds <= 1.5) {
    // Short answer (1-5 words): "ya", "okay", "setuju"
    requiredSilence = 700; // 0.7s
  } else if (estimatedSeconds <= 4.0) {
    // Medium answer (6-15 words): normal conversation
    requiredSilence = 1000; // 1.0s
  } else {
    // Long answer (16+ words): detailed responses, addresses
    requiredSilence = 1200; // 1.2s
  }

  const hasSilence = timeSinceLastActivity >= requiredSilence;

  if (hasMinimumAudio && hasSilence) {
    console.log(`🎯 Smart endpointing: ${estimatedSeconds.toFixed(1)}s audio → ${requiredSilence}ms timeout → processing ${totalSize} bytes...`);
    session.isProcessingAudio = true;

    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of session.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    session.audioBuffer = [];

    // PRE-CHECK: Calculate average RMS of entire buffer to skip obvious silence
    // This saves 200-300ms Azure STT call for silent chunks
    const samples = new Int16Array(combined.buffer, combined.byteOffset, combined.length / 2);
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const avgRms = Math.sqrt(sumSquares / samples.length);

    if (avgRms < 500) {
      // Buffer is pure silence - skip Azure STT call entirely
      console.log(`⏭️  Skipping transcription: buffer is silence (RMS: ${avgRms.toFixed(0)})`);
      session.isProcessingAudio = false;
      return;
    }

    console.log(`🎤 Buffer has audio content (RMS: ${avgRms.toFixed(0)}), transcribing...`);

    // AUDIO NORMALIZATION: Fix volume inconsistency (adds ~1ms, no noticeable delay)
    const targetRms = 1000; // Target volume level for consistent audio
    if (avgRms > 0 && avgRms !== targetRms) {
      const gainFactor = targetRms / avgRms;
      for (let i = 0; i < samples.length; i++) {
        // Apply gain and clamp to prevent distortion
        samples[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * gainFactor)));
      }
      console.log(`🔊 Normalized audio: ${avgRms.toFixed(0)} → ${targetRms} (gain: ${gainFactor.toFixed(2)}x)`);
    }
    await transcribeAudio(session, combined);
    session.isProcessingAudio = false;
  }
}

// Helper function to create WAV header for PCM audio
function createWavHeader(audioLength: number) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, audioLength + 36, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, 8000, true); // Sample rate
  view.setUint32(28, 16000, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, audioLength, true);

  return new Uint8Array(header);
}

async function transcribeAudio(session: any, audioBytes: Uint8Array) {
  try {
    // Require minimum 3200 bytes (~0.2 seconds) to avoid garbage transcription
    if (audioBytes.length < 3200) return;

    console.log(`🎙️ Transcribing ${audioBytes.length} bytes...`);

    // Create WAV file
    const wavHeader = createWavHeader(audioBytes.length);
    const wavFile = new Uint8Array(wavHeader.length + audioBytes.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(audioBytes, wavHeader.length);

    // Azure STT with enhanced parameters for better accuracy
    const response = await fetch(
      `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?` +
      `language=ms-MY&` +
      `profanity=raw&` +  // Don't filter profanity (preserve natural speech)
      `format=detailed`,   // Get confidence scores
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || '',
          'Content-Type': 'audio/wav; codec=audio/pcm; samplerate=8000',
        },
        body: wavFile,
      }
    );

    if (!response.ok) {
      console.log(`❌ Azure STT error: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();

    if (result.RecognitionStatus === 'Success' && result.DisplayText) {
      const transcript = result.DisplayText.trim();

      // Get confidence score if available
      const confidence = result.NBest?.[0]?.Confidence || 0;

      // Only accept transcripts with reasonable confidence (> 0.3) or length (> 2 chars)
      if (transcript.length > 1 && (confidence > 0.3 || transcript.length > 2)) {
        console.log(`🗣️  Customer: "${transcript}" (confidence: ${confidence.toFixed(2)})`);

        session.transcript.push({ speaker: 'user', text: transcript, timestamp: new Date() });
        session.conversationHistory.push({ role: 'user', content: transcript });

        // 🚀 GREEDY INFERENCE: Start AI immediately with partial transcript
        startGreedyAIRequest(session, transcript);

        // ONLY call getAIResponse if we have actual speech
        // This prevents filler words from playing on background noise
        await getAIResponse(session, transcript);
      } else {
        console.log(`⚠️  Low confidence transcription ignored: "${transcript}" (${confidence.toFixed(2)})`);
      }
    } else {
      // No speech detected - just silence or noise
      console.log(`🔇 No speech detected in audio chunk (status: ${result.RecognitionStatus})`);
    }
  } catch (error) {
    console.error("❌ Transcription error:", error);
  }
}

// 🚀 GREEDY INFERENCE: Start AI request immediately (can be cancelled)
function startGreedyAIRequest(session: any, partialTranscript: string) {
  // Skip if AI is already speaking or if customer stopped talking (silence detected)
  if (session.isSpeaking || !session.isProcessingAudio) {
    return;
  }

  // Cancel previous greedy request if exists
  if (session.greedyAI.controller) {
    console.log('🔄 Cancelling previous greedy AI request (customer still talking)');
    session.greedyAI.controller.abort();
  }

  // Update partial transcript
  session.greedyAI.partialTranscript = partialTranscript;
  session.greedyAI.isActive = true;

  // Create new AbortController for this request
  session.greedyAI.controller = new AbortController();

  console.log(`🚀 Starting greedy AI request with partial: "${partialTranscript.substring(0, 50)}..."`);

  // Start AI request in background (non-blocking)
  session.greedyAI.promise = fetchAIResponseWithAbort(
    session,
    session.greedyAI.controller.signal
  ).catch(error => {
    // Silently ignore abort errors (expected when customer continues talking)
    if (error.name === 'AbortError') {
      console.log('✅ Greedy AI request cancelled (expected)');
      return null;
    }
    console.error('❌ Greedy AI error:', error);
    return null;
  });
}

// Fetch AI response with abort support
async function fetchAIResponseWithAbort(session: any, signal: AbortSignal) {
  // Prepare messages - conversationHistory already has the latest user message
  const messages = [
    ...session.conversationHistory,
    {
      role: 'system',
      content: '⚠️ CRITICAL REMINDER: Your next response MUST start with !!Stage [name]!! - Choose the correct stage based on the conversation flow. Do not forget this!'
    }
  ];

  // Call OpenRouter with abort signal
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aicallpro.com',
      'X-Title': 'AI Call Pro'
    },
    body: JSON.stringify({
      model: session.systemSettings.openrouterModel,
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
    }),
    signal: signal  // 👈 This allows cancellation!
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No AI response generated');
  }

  return data.choices[0]?.message?.content;
}

async function getAIResponse(session: any, userMessage: string) {
  try {
    console.log("🤖 Getting AI response...");

    let aiResponse = null;

    // 🚀 GREEDY INFERENCE: Check if we already have a response from greedy request
    if (session.greedyAI.isActive && session.greedyAI.promise) {
      console.log('⚡ Checking if greedy AI response is ready...');

      try {
        // Wait for greedy response (might already be complete!)
        aiResponse = await session.greedyAI.promise;

        if (aiResponse) {
          console.log('✅ Using greedy AI response (saved time!)');
          // Clear greedy state
          session.greedyAI.isActive = false;
          session.greedyAI.promise = null;
          session.greedyAI.controller = null;
        }
      } catch (error) {
        // Greedy request failed or was cancelled, fall back to normal request
        console.log('⚠️  Greedy AI failed, falling back to normal request');
        aiResponse = null;
      }
    }

    // If no greedy response, make normal request
    if (!aiResponse) {
      console.log('📡 Making fresh AI request...');

      // Inject a reminder before the latest user message to force compliance
      let messages = session.conversationHistory;
      if (session.conversationHistory.length > 1) {
        messages = [
          ...session.conversationHistory,
          {
            role: 'system',
            content: '⚠️ CRITICAL REMINDER: Your next response MUST start with !!Stage [name]!! - Choose the correct stage based on the conversation flow. Do not forget this!'
          }
        ];
      }

      // Direct call to OpenRouter GPT-4o-mini - reliable and fast
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aicallpro.com',
          'X-Title': 'AI Call Pro'
        },
        body: JSON.stringify({
          model: session.systemSettings.openrouterModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      const data = await response.json();

      // Check for API errors
      if (!response.ok || data.error) {
        console.error('❌ OpenRouter API error:', data);
        throw new Error(data.error?.message || `OpenRouter API error: ${response.status}`);
      }

      if (!data.choices || data.choices.length === 0) {
        console.error('❌ No choices in response:', data);
        throw new Error('No AI response generated');
      }

      aiResponse = data.choices[0]?.message?.content;
    }

    if (aiResponse) {
      console.log(`💬 AI (raw): "${aiResponse}"`);

      // 🎯 STAGE DETECTION: Extract stage marker BEFORE cleaning
      const stageMatch = aiResponse.match(/!!Stage\s+([^!]+)!!/);
      if (stageMatch) {
        const newStage = stageMatch[1].trim();

        // Only update if this is a different stage
        if (newStage !== session.currentStage) {
          const oldStage = session.currentStage;
          session.currentStage = newStage;
          console.log(`🎯 Stage transition: "${oldStage}" → "${newStage}"`);

          // Update database with new stage (non-blocking for faster response)
          supabaseAdmin
            .from('call_logs')
            .update({ stage_reached: newStage })
            .eq('call_id', session.callId)
            .then(({ error }) => {
              if (error) console.error(`❌ Failed to update stage:`, error);
              else console.log(`✅ Stage saved: "${newStage}"`);
            });
        }
      } else {
        console.log(`⚠️ No !!Stage marker!! found in AI response - AI should include stage markers!`);
      }

      // 📝 DETAILS EXTRACTION: Extract details BEFORE cleaning
      // Use regex to find content between %% markers (supports multiline)
      const detailsMatch = aiResponse.match(/%%(.+?)%%/s);
      if (detailsMatch) {
        const details = detailsMatch[1].trim();
        console.log(`📝 Extracted details (${details.length} chars):`);
        console.log(details);

        // Save details to database (non-blocking for faster response)
        supabaseAdmin
          .from('call_logs')
          .update({ details: details })
          .eq('call_id', session.callId)
          .then(({ error }) => {
            if (error) console.error(`❌ Failed to save details:`, error);
            else console.log(`✅ Details saved successfully`);
          });
      } else {
        // Log if AI should have provided details but didn't
        if (aiResponse.includes('%%')) {
          console.warn(`⚠️ AI response contains %% but format is incorrect - check AI output`);
          console.warn(`   AI Response: ${aiResponse.substring(0, 200)}...`);
        }
      }

      // 🧹 CLEAN AI RESPONSE: Remove all internal markers
      // This cleaned version is what customer hears AND sees in transcript
      let cleanResponse = aiResponse
        .replace(/!!Stage\s+[^!]+!!/g, '') // Remove !!Stage Name!!
        .replace(/%%[^%]+%%/g, '') // Remove %%details%%
        .replace(/\[end_call\]/gi, '') // Remove [end_call]
        .trim();

      console.log(`💬 AI (clean): "${cleanResponse}"`);

      // Save CLEANED response to conversation history and transcript
      // Customer only sees/hears the clean version
      session.conversationHistory.push({ role: 'assistant', content: cleanResponse });
      session.transcript.push({ speaker: 'assistant', text: cleanResponse, timestamp: new Date() });

      // 🛑 END CALL DETECTION: Check if AI response contains end_call command
      if (aiResponse.toLowerCase().includes('end_call')) {
        console.log(`🛑 end_call detected - terminating call after speaking`);

        // Speak the cleaned response first
        if (cleanResponse) {
          await speakToCall(session, cleanResponse);
        }

        // Wait for speech to finish (optimized from 2000ms to 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Hangup the call
        try {
          const { FreeSwitchESLClient } = await import('../_shared/freeswitch-esl-client.ts');
          const eslClient = new FreeSwitchESLClient(
            FREESWITCH_HOST,
            FREESWITCH_ESL_PORT,
            FREESWITCH_ESL_PASSWORD
          );

          const hungup = await eslClient.hangupCall(session.callId);
          if (hungup) {
            console.log(`✅ Call terminated successfully via end_call`);
          } else {
            console.error(`❌ Failed to terminate call via end_call`);
          }
        } catch (hangupError) {
          console.error(`❌ Error terminating call:`, hangupError);
        }

        return; // Don't speak again
      }

      // Speak the cleaned response (without markers)
      await speakToCall(session, cleanResponse);
    }
  } catch (error) {
    console.error("❌ AI error:", error);
  }
}

async function speakToCall(session: any, text: string) {
  try {
    session.isSpeaking = true;
    console.log(`🔊 Speaking (STREAMING): "${text}"`);

    // Use ElevenLabs WebSocket streaming API for 70-80% faster start time
    // Same cost as standard API, but audio starts playing in ~200ms instead of ~1000ms
    const streamStartTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${session.voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
      const ws = new WebSocket(wsUrl);

      const audioChunks: Uint8Array[] = [];
      let hasStartedPlaying = false;
      let hasPlayedAudio = false; // Track if we already played audio to prevent duplicates

      ws.onopen = () => {
        console.log(`🌊 ElevenLabs streaming connected`);

        // Send the text to generate
        ws.send(JSON.stringify({
          text: text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 1.0,
            style: 0.0,
            use_speaker_boost: true,
          },
          xi_api_key: ELEVENLABS_API_KEY,
        }));

        // Signal end of input
        ws.send(JSON.stringify({ text: "" }));
      };

      ws.onmessage = async (event) => {
        try {
          if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);

            if (message.audio) {
              // Decode base64 audio chunk
              const audioData = Uint8Array.from(atob(message.audio), c => c.charCodeAt(0));
              const pcm16k = new Int16Array(audioData.buffer);

              // Downsample 16kHz → 8kHz
              const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
              for (let i = 0; i < pcm8k.length; i++) {
                pcm8k[i] = pcm16k[i * 2];
              }

              // NORMALIZE AI VOICE OUTPUT: Fix volume inconsistency (loud/quiet issue)
              let sumSquares = 0;
              for (let i = 0; i < pcm8k.length; i++) {
                sumSquares += pcm8k[i] * pcm8k[i];
              }
              const rms = Math.sqrt(sumSquares / pcm8k.length);

              // Target RMS for consistent volume (adjust if needed: higher = louder)
              const targetRms = 2500; // Consistent AI voice level
              if (rms > 100) { // Only normalize if there's actual audio
                const gainFactor = targetRms / rms;
                for (let i = 0; i < pcm8k.length; i++) {
                  pcm8k[i] = Math.max(-32768, Math.min(32767, Math.round(pcm8k[i] * gainFactor)));
                }
              }

              audioChunks.push(new Uint8Array(pcm8k.buffer));

              // Log first chunk received (for latency tracking)
              if (!hasStartedPlaying) {
                hasStartedPlaying = true;
                const latency = Date.now() - streamStartTime;
                console.log(`⚡ First audio chunk received in ${latency}ms`);
              }
            }

            if (message.isFinal) {
              console.log(`✅ ElevenLabs streaming complete - received ${audioChunks.length} chunks`);

              // Play ALL accumulated chunks now that streaming is complete
              if (audioChunks.length > 0 && !hasPlayedAudio) {
                hasPlayedAudio = true; // Mark as played to prevent duplicate in onclose
                await playAudioChunks(session, audioChunks);
              }

              ws.close();
              resolve();
            }
          }
        } catch (error) {
          console.error("❌ Error processing streaming chunk:", error);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ ElevenLabs WebSocket error:", error);
        ws.close();
        session.isSpeaking = false;
        reject(error);
      };

      ws.onclose = () => {
        // Fallback: if we have chunks but isFinal wasn't received AND we haven't played yet
        if (audioChunks.length > 0 && !hasPlayedAudio) {
          console.log(`⚠️  WebSocket closed without isFinal, playing ${audioChunks.length} accumulated chunks`);
          hasPlayedAudio = true;
          playAudioChunks(session, audioChunks)
            .then(resolve)
            .catch(reject);
        } else if (hasPlayedAudio) {
          console.log(`✅ WebSocket closed (audio already played)`);
          resolve();
        } else {
          resolve();
        }
      };
    });

  } catch (error) {
    console.error("❌ TTS streaming error:", error);
    session.isSpeaking = false;
  }
}

// Helper function to play accumulated audio chunks
async function playAudioChunks(session: any, chunks: Uint8Array[]): Promise<void> {
  // Combine all chunks
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Base64 encode
  let base64Audio = '';
  const chunkSize = 32768;
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, Math.min(i + chunkSize, combined.length));
    base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
  }

  console.log(`📦 Sending ${combined.length} bytes of streamed L16 PCM audio...`);

  // Send to FreeSWITCH
  const audioMessage = JSON.stringify({
    type: "streamAudio",
    data: {
      audioDataType: "raw",
      sampleRate: 8000,
      audioData: base64Audio
    }
  });

  if (session.socket.readyState === WebSocket.OPEN) {
    session.socket.send(audioMessage);

    const audioDurationMs = (combined.length / 16000) * 1000;
    console.log(`⏱️  Audio duration: ${audioDurationMs.toFixed(0)}ms`);

    // Play via FreeSWITCH (optimized: removed 100ms delay)
    try {
      const conn = await Deno.connect({
        hostname: FREESWITCH_HOST,
        port: FREESWITCH_ESL_PORT,
      });

      await readESLResponse(conn);
      await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
      await readESLResponse(conn);

      const fileNum = session.audioFileCounter || 0;
      session.audioFileCounter = fileNum + 1;
      const audioFile = `/tmp/${session.callId}_${fileNum}.tmp.r8`;

      const fileString = `file_string://{rate=8000,channels=1}${audioFile}`;
      const broadcastCmd = `api uuid_broadcast ${session.callId} ${fileString} aleg`;
      console.log(`🎵 Playing streamed audio: ${broadcastCmd}`);

      await sendESLCommand(conn, broadcastCmd);
      const broadcastResponse = await readESLResponse(conn);
      console.log(`🎵 Broadcast response: ${broadcastResponse}`);

      conn.close();

      setTimeout(() => {
        session.isSpeaking = false;
        console.log("✅ Streamed audio playback complete");
      }, audioDurationMs + 200);

    } catch (error) {
      console.error("❌ Error playing streamed audio:", error);
      session.isSpeaking = false;
    }
  } else {
    session.isSpeaking = false;
  }
}

// ESL helper functions
async function sendESLCommand(conn: Deno.Conn, command: string): Promise<void> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(command + '\n\n'));
}

async function readESLResponse(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);
  let response = '';

  while (true) {
    const bytesRead = await conn.read(buffer) || 0;
    if (bytesRead === 0) break;

    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    response += chunk;

    if (response.includes('\n\n')) {
      const contentLengthMatch = response.match(/Content-Length:\s*(\d+)/i);
      if (contentLengthMatch) {
        const contentLength = parseInt(contentLengthMatch[1]);
        const headerEnd = response.indexOf('\n\n') + 2;
        const bodyLength = response.length - headerEnd;
        if (bodyLength >= contentLength) break;
      } else {
        break;
      }
    }

    if (response.length > 100000) break;
  }

  return response;
}
