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
const FREESWITCH_HOST = Deno.env.get('FREESWITCH_HOST') || '159.223.45.224';
const FREESWITCH_ESL_PORT = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021');
const FREESWITCH_ESL_PASSWORD = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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

        console.log(`⏱️  Call duration: ${durationSeconds} seconds`);

        // 📝 Format transcript as readable text
        const transcriptText = session.transcript
          .map((entry: any) => {
            const speaker = entry.speaker === 'assistant' ? 'AI' : 'Customer';
            return `[${speaker}]: ${entry.text}`;
          })
          .join('\n\n');

        // 💰 Calculate cost (RM 0.15 per minute or less)
        const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute
        const cost = durationMinutes * 0.15;

        console.log(`💰 Cost: RM ${cost.toFixed(2)} (${durationMinutes} minute(s))`);

        // 🎙️ Recording URL (served via nginx from FreeSWITCH server)
        const recordingUrl = `http://${FREESWITCH_HOST}/recordings/${callId}.wav`;

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
    const { userId, campaignName, promptId, phoneNumbers, phoneNumbersWithNames } = await req.json();

    if (!userId || !phoneNumbers) {
      throw new Error('Missing userId or phoneNumbers');
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) throw new Error('User not found');

    // Get prompt
    const { data: prompt } = await supabaseAdmin
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .eq('user_id', userId)
      .single();

    if (!prompt) throw new Error('Prompt not found');

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id: userId,
        campaign_name: campaignName,
        prompt_id: prompt.id,
        status: 'in_progress',
        total_numbers: phoneNumbers.length,
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      throw new Error('Failed to create campaign: ' + (campaignError?.message || 'Unknown error'));
    }

    const WEBSOCKET_URL = `wss://${req.headers.get('host')}`;

    // Process calls
    const results = await Promise.all(phoneNumbers.map(async (phoneNumber: string) => {
      try {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const callId = await originateCallWithAudioStream({
          phoneNumber: cleanNumber,
          userId,
          campaignId: campaign.id,
          promptId: prompt.id,
          websocketUrl: WEBSOCKET_URL,
        });

        // 🎯 Extract first stage from prompt for initial stage_reached value
        const stageRegex = /!!Stage\s+([^!]+)!!/;
        const firstStageMatch = prompt.system_prompt?.match(stageRegex);
        const initialStage = firstStageMatch ? firstStageMatch[1].trim() : null;

        await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaign.id,
          user_id: userId,
          call_id: callId,
          phone_number: phoneNumber,
          status: 'initiated',
          stage_reached: initialStage, // Set initial stage from prompt
        });

        return { success: true, phoneNumber, callId };
      } catch (error) {
        return { success: false, phoneNumber, error: String(error) };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'completed',
        successful_calls: successCount,
        failed_calls: failedCount
      })
      .eq('id', campaign.id);

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
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
  const { phoneNumber, userId, campaignId, promptId, websocketUrl } = params;

  const conn = await Deno.connect({
    hostname: FREESWITCH_HOST,
    port: FREESWITCH_ESL_PORT,
  });

  // Authenticate
  await readESLResponse(conn);
  await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
  await readESLResponse(conn);

  // Build originate command - first originate and park, then start audio_stream
  // 🎙️ CALL RECORDING: Use ${uuid} variable for recording path (FreeSWITCH will substitute it)
  const recordingPath = `/var/www/html/recordings/\${uuid}.wav`;
  const vars = [
    `user_id=${userId}`,
    `campaign_id=${campaignId}`,
    `prompt_id=${promptId}`,
    `origination_caller_id_number=${phoneNumber}`,
    `execute_on_answer=record_session ${recordingPath}`, // Start recording when answered
  ].join(',');

  // Originate and park the call first
  const originateCmd = `api originate {${vars}}sofia/gateway/external::1360d030-6e0c-4617-83e0-8d80969010cf/${phoneNumber} &park()`;

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
  console.log(`🎙️ Recording will be saved to: /var/www/html/recordings/${callId}.wav`);

  // Now start audio streaming on the parked call
  // uuid_audio_stream <uuid> start <wss-url> [mono|mixed|stereo] [8000|16000] [metadata]
  // Build metadata JSON
  const metadata = JSON.stringify({
    call_id: callId,
    user_id: userId,
    campaign_id: campaignId,
    prompt_id: promptId
  });

  const audioStreamCmd = `api uuid_audio_stream ${callId} start ${websocketUrl} mono 8000 ${metadata}`;

  console.log(`🎤 Starting audio stream: ${audioStreamCmd}`);

  await sendESLCommand(conn, audioStreamCmd);
  const streamResponse = await readESLResponse(conn);

  console.log(`📋 Audio stream Response: ${streamResponse}`);

  // DON'T start monitoring here - will be in different Deno isolate!
  // WebSocket handler will start monitoring when it connects

  conn.close();

  return callId;
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

  console.log(`📞 Call started: ${callId}`);

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
    // 🎯 STAGE TRACKING
    stages: stages, // All available stages from prompt
    currentStage: stages.length > 0 ? stages[0] : null, // Start with first stage
    promptId: promptId, // Store for database updates
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

  // Process if we have enough audio AND 1.5 seconds of silence detected
  const totalSize = session.audioBuffer.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  const timeSinceLastActivity = Date.now() - (session.lastAudioActivityTime || Date.now());
  const hasMinimumAudio = totalSize >= 16000; // At least 1 second of audio
  const hasSilence = timeSinceLastActivity >= 1500; // 1.5 seconds of silence (reduced from 2.0s for faster response)

  if (hasMinimumAudio && hasSilence) {
    console.log(`🔇 Detected 1.5 seconds of silence, processing ${totalSize} bytes...`);
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

async function getAIResponse(session: any, userMessage: string) {
  try {
    console.log("🤖 Getting AI response...");

    // Direct call to GPT - no filler words for maximum speed
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: session.conversationHistory,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (aiResponse) {
      console.log(`💬 AI: "${aiResponse}"`);

      session.conversationHistory.push({ role: 'assistant', content: aiResponse });
      session.transcript.push({ speaker: 'assistant', text: aiResponse, timestamp: new Date() });

      // 🎯 STAGE DETECTION: Check if AI response contains stage marker
      const stageMatch = aiResponse.match(/!!Stage\s+([^!]+)!!/);
      if (stageMatch) {
        const newStage = stageMatch[1].trim();

        // Only update if this is a different stage
        if (newStage !== session.currentStage) {
          const oldStage = session.currentStage;
          session.currentStage = newStage;
          console.log(`🎯 Stage transition: "${oldStage}" → "${newStage}"`);

          // Update database with new stage
          try {
            const { error: updateError } = await supabaseAdmin
              .from('call_logs')
              .update({ stage_reached: newStage })
              .eq('call_id', session.callId);

            if (updateError) {
              console.error(`❌ Failed to update stage in database:`, updateError);
            } else {
              console.log(`✅ Stage saved to database: "${newStage}"`);
            }
          } catch (dbError) {
            console.error(`❌ Database error updating stage:`, dbError);
          }
        }
      }

      // 📝 DETAILS EXTRACTION: Check if AI response contains %% wrapped content
      const detailsMatch = aiResponse.match(/%%(.+?)%%/s);
      if (detailsMatch) {
        const details = detailsMatch[1].trim();
        console.log(`📝 Extracted details: "${details}"`);

        // Save details to database
        try {
          const { error: detailsError } = await supabaseAdmin
            .from('call_logs')
            .update({ details: details })
            .eq('call_id', session.callId);

          if (detailsError) {
            console.error(`❌ Failed to save details to database:`, detailsError);
          } else {
            console.log(`✅ Details saved to database`);
          }
        } catch (dbError) {
          console.error(`❌ Database error saving details:`, dbError);
        }
      }

      // 🛑 END CALL DETECTION: Check if AI response contains end_call command
      if (aiResponse.toLowerCase().includes('end_call')) {
        console.log(`🛑 end_call detected - terminating call after speaking`);

        // Speak the response first (without the end_call command)
        const cleanResponse = aiResponse.replace(/end_call/gi, '').trim();
        if (cleanResponse) {
          await speakToCall(session, cleanResponse);
        }

        // Wait a bit for the speech to finish
        await new Promise(resolve => setTimeout(resolve, 2000));

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

      await speakToCall(session, aiResponse);
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

    // Play via FreeSWITCH
    setTimeout(async () => {
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
        }, audioDurationMs + 500);

      } catch (error) {
        console.error("❌ Error playing streamed audio:", error);
        session.isSpeaking = false;
      }
    }, 100);
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
