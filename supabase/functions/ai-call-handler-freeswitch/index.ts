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

    socket.onclose = () => {
      console.log("📞 Call ended");
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

        await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaign.id,
          user_id: userId,
          call_id: callId,
          phone_number: phoneNumber,
          status: 'initiated',
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
  const vars = [
    `user_id=${userId}`,
    `campaign_id=${campaignId}`,
    `prompt_id=${promptId}`,
    `origination_caller_id_number=${phoneNumber}`,
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
 * Monitor for CHANNEL_ANSWER event and notify WebSocket handler
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

    // Subscribe to CHANNEL_ANSWER events for this specific call
    await sendESLCommand(conn, `filter Unique-ID ${callId}`);
    await readESLResponse(conn);

    await sendESLCommand(conn, `event CHANNEL_ANSWER`);
    await readESLResponse(conn);

    console.log(`👂 Monitoring call ${callId} for ANSWER event...`);

    // Wait for CHANNEL_ANSWER event (non-blocking)
    const answerEvent = await readESLResponse(conn);

    if (answerEvent.includes('CHANNEL_ANSWER')) {
      console.log(`✅ Call ${callId} ANSWERED by customer!`);

      // Wait for session to be created (race condition fix)
      // WebSocket might be slower than ESL event
      let session = activeCalls.get(callId);
      let retries = 0;
      const maxRetries = 30; // Wait up to 3 seconds (30 x 100ms)

      while (!session && retries < maxRetries) {
        console.log(`⏳ Waiting for session ${callId} to be created... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        session = activeCalls.get(callId);
        retries++;
      }

      console.log(`🔍 Debug: session=${!!session}, hasGreeted=${session?.hasGreeted}, firstMessage="${session?.firstMessage}"`);

      if (session && !session.hasGreeted) {
        session.isCallAnswered = true;
        console.log(`📞 Triggering greeting for ${callId}...`);
        await speakToCall(session, session.firstMessage);
        session.hasGreeted = true;
      } else if (!session) {
        console.error(`❌ Session ${callId} not found in activeCalls after ${maxRetries} retries!`);
      } else if (session.hasGreeted) {
        console.log(`⚠️ Session ${callId} already greeted, skipping`);
      }
    }

    conn.close();
  } catch (error) {
    console.error(`❌ Error monitoring call ${callId}:`, error);
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
  let firstMessage = "Hello! How can I help you today?";

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

  if (promptId && userId) {
    const { data: promptData } = await supabaseAdmin
      .from('prompts')
      .select('system_prompt, first_message')
      .eq('id', promptId)
      .eq('user_id', userId)
      .single();

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      firstMessage = promptData.first_message;
    }
  }

  // Initialize session (SAME AS TWILIO!)
  const session = {
    callId,
    userId,
    campaignId,
    systemPrompt,
    firstMessage,
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

  // Process if we have enough audio AND 2 seconds of silence detected
  const totalSize = session.audioBuffer.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  const timeSinceLastActivity = Date.now() - (session.lastAudioActivityTime || Date.now());
  const hasMinimumAudio = totalSize >= 16000; // At least 1 second of audio
  const hasSilence = timeSinceLastActivity >= 2000; // 2 seconds of silence

  if (hasMinimumAudio && hasSilence) {
    console.log(`🔇 Detected 2 seconds of silence, processing ${totalSize} bytes...`);
    session.isProcessingAudio = true;

    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of session.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    session.audioBuffer = [];

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

        await getAIResponse(session, transcript);
      } else {
        console.log(`⚠️  Low confidence transcription ignored: "${transcript}" (${confidence.toFixed(2)})`);
      }
    }
  } catch (error) {
    console.error("❌ Transcription error:", error);
  }
}

/**
 * Get random acknowledgment filler word to play while AI is thinking
 * Makes conversation feel more natural and human-like
 */
function getRandomFillerWord(): string {
  const fillers = [
    "Ooo",
    "Faham cik",
    "Okay baik",
    "Baiklah cik",
    "Yerr cik",
    "Ha, okay",
    "Ooo macam tu",
    "Baik, baik",
    "Hmm faham",
    "Okay cik",
  ];
  return fillers[Math.floor(Math.random() * fillers.length)];
}

async function getAIResponse(session: any, userMessage: string) {
  try {
    console.log("🤖 Getting AI response...");

    // INSTANT FEEDBACK: Play filler word immediately while AI processes
    const fillerWord = getRandomFillerWord();
    console.log(`💬 Filler: "${fillerWord}" (buying time while AI thinks...)`);

    // Start playing filler word (don't await - let it play in background)
    const fillerPromise = speakToCall(session, fillerWord, true); // true = isFiller

    // Add acknowledgment to conversation history so AI knows we already responded
    // This prevents AI from repeating acknowledgments like "Ooo", "Baik" etc.
    session.conversationHistory.push({
      role: 'assistant',
      content: `[Already acknowledged with: "${fillerWord}"]`
    });

    // Inject instruction to AI: continue naturally after acknowledgment
    const messagesWithInstruction = [
      ...session.conversationHistory,
      {
        role: 'system',
        content: `You just said "${fillerWord}" as acknowledgment. Now continue the conversation naturally without repeating acknowledgments. Jump straight to your main response.`
      }
    ];

    // While filler is playing, get AI response in parallel
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: messagesWithInstruction,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (aiResponse) {
      console.log(`💬 AI: "${aiResponse}"`);

      // Add the actual AI response to history (not the instruction)
      session.conversationHistory.push({ role: 'assistant', content: aiResponse });
      session.transcript.push({ speaker: 'assistant', text: `${fillerWord} ... ${aiResponse}`, timestamp: new Date() });

      // Wait for filler to finish before speaking main response
      await fillerPromise;

      await speakToCall(session, aiResponse, false); // false = not filler
    }
  } catch (error) {
    console.error("❌ AI error:", error);
  }
}

async function speakToCall(session: any, text: string, isFiller: boolean = false) {
  try {
    session.isSpeaking = true;

    if (isFiller) {
      console.log(`🎤 Filler word: "${text}"`);
    } else {
      console.log(`🔊 Speaking: "${text}"`);
    }

    // Get PCM from ElevenLabs at 16kHz (will downsample to 8kHz)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${session.voiceId}?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 1.0,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    const pcmBuffer = await response.arrayBuffer();
    const pcm16k = new Int16Array(pcmBuffer);

    // Downsample 16kHz → 8kHz (take every other sample)
    const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
    for (let i = 0; i < pcm8k.length; i++) {
      pcm8k[i] = pcm16k[i * 2];
    }

    // Convert to Uint8Array for base64 encoding (keep as L16 PCM)
    const pcmBytes = new Uint8Array(pcm8k.buffer);

    // Base64 encode in chunks to avoid stack overflow
    let base64Audio = '';
    const chunkSize = 32768;
    for (let i = 0; i < pcmBytes.length; i += chunkSize) {
      const chunk = pcmBytes.subarray(i, Math.min(i + chunkSize, pcmBytes.length));
      base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
    }

    console.log(`📦 Sending ${pcmBytes.length} bytes of L16 PCM audio (${base64Audio.length} base64 chars)...`);

    // Send audio in mod_audio_stream JSON format
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
      console.log("✅ Audio sent to FreeSWITCH in JSON format!");

      // Calculate audio duration (bytes / sample_rate / bytes_per_sample)
      // 8000 samples/sec, 2 bytes per sample (16-bit) = 16000 bytes/sec
      const audioDurationMs = (pcmBytes.length / 16000) * 1000;
      console.log(`⏱️  Audio duration: ${audioDurationMs.toFixed(0)}ms`);

      // mod_audio_stream saves the file but doesn't auto-play it
      // We need to play it manually using uuid_broadcast
      // Give it a moment to save the file, then play it
      setTimeout(async () => {
        try {
          const conn = await Deno.connect({
            hostname: FREESWITCH_HOST,
            port: FREESWITCH_ESL_PORT,
          });

          await readESLResponse(conn);
          await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
          await readESLResponse(conn);

          // Use the latest temp file number
          const fileNum = session.audioFileCounter || 0;
          session.audioFileCounter = fileNum + 1;
          const audioFile = `/tmp/${session.callId}_${fileNum}.tmp.r8`;

          // Play the audio file using file_string:// to explicitly specify L16 PCM format
          // Correct syntax: file_string://{param1=value1,param2=value2}path/to/file
          const fileString = `file_string://{rate=8000,channels=1}${audioFile}`;
          const broadcastCmd = `api uuid_broadcast ${session.callId} ${fileString} aleg`;
          console.log(`🎵 Playing audio: ${broadcastCmd}`);

          await sendESLCommand(conn, broadcastCmd);
          const broadcastResponse = await readESLResponse(conn);
          console.log(`🎵 Broadcast response: ${broadcastResponse}`);

          conn.close();

          // Wait for audio to finish playing before releasing the speaking flag
          // Add 500ms buffer for smooth transition
          setTimeout(() => {
            session.isSpeaking = false;
            console.log("✅ Audio playback complete, ready for customer input");
          }, audioDurationMs + 500);

        } catch (error) {
          console.error("❌ Error playing audio:", error);
          session.isSpeaking = false; // Release flag on error
        }
      }, 100); // Wait 100ms for file to be saved
    } else {
      session.isSpeaking = false;
    }
  } catch (error) {
    console.error("❌ TTS error:", error);
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
