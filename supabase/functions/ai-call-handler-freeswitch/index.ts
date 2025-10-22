/**
 * AI Call Handler for FreeSWITCH + AlienVOIP
 *
 * Receives real-time audio from FreeSWITCH mod_audio_fork via WebSocket
 * Processes with Azure STT → OpenRouter GPT → ElevenLabs TTS
 * Streams audio back to customer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Audio format constants for FreeSWITCH
const SAMPLE_RATE = 8000; // FreeSWITCH sends 8kHz
const CHANNELS = 1; // Mono
const BITS_PER_SAMPLE = 16; // 16-bit PCM

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// In-memory cache for generated audio files
const audioCache = new Map<string, Uint8Array>();

serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === '/health') {
    return new Response('OK - FreeSWITCH AI Handler Ready', { status: 200 });
  }

  // Batch Call endpoint - handles massive concurrent calls (200 clients × 1000 calls each)
  if (url.pathname === '/batch-call' && req.method === 'POST') {
    try {
      const requestBody = await req.json();
      const { userId, campaignName, promptId, phoneNumbers, phoneNumbersWithNames, retryEnabled, retryIntervalMinutes, maxRetryAttempts } = requestBody;

      if (!userId || !phoneNumbers || !Array.isArray(phoneNumbers)) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters: userId, phoneNumbers' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🚀 Starting batch call campaign: ${campaignName} for user: ${userId}`);
      console.log(`📞 Total numbers: ${phoneNumbers.length}`);

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, credits_balance')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check credits (AlienVOIP: RM0.008/min, estimate 2 min per call)
      const estimatedCostPerCall = 0.016; // RM0.008 × 2 min
      const estimatedTotalCost = phoneNumbers.length * estimatedCostPerCall;
      const requiredBalance = estimatedTotalCost * 0.5; // Require 50% upfront

      if (userData.credits_balance < requiredBalance) {
        return new Response(
          JSON.stringify({
            error: `Insufficient credits. Required: RM${requiredBalance.toFixed(2)}, Available: RM${userData.credits_balance.toFixed(2)}. Please top up.`
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: userData.id,
          campaign_name: campaignName,
          prompt_id: promptId,
          status: 'in_progress',
          total_numbers: phoneNumbers.length,
          retry_enabled: retryEnabled || false,
          retry_interval_minutes: retryIntervalMinutes || 30,
          max_retry_attempts: maxRetryAttempts || 3,
          current_retry_count: 0
        })
        .select()
        .single();

      if (campaignError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create campaign: ' + campaignError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Created campaign ${campaign.id}`);

      // Process all calls concurrently (handles 200k+ calls easily on Deno Deploy)
      const callPromises = phoneNumbers.map(async (phoneNumber: string, index: number) => {
        try {
          // Get customer name from map
          const customerData = phoneNumbersWithNames?.find((item: any) => item.phone_number === phoneNumber);
          const customerName = customerData?.customer_name || '';

          console.log(`📞 [${index + 1}/${phoneNumbers.length}] Calling ${phoneNumber} via FreeSWITCH ESL`);

          // Connect to FreeSWITCH ESL and originate call
          const callResult = await originateCallViaESL({
            phoneNumber,
            extension: '99999',
            variables: {
              user_id: userId,
              campaign_id: campaign.id,
              prompt_id: promptId,
              customer_name: customerName,
              ai_handler_url: `wss://${req.headers.get('host')}/audio`
            }
          });

          if (!callResult.success) {
            throw new Error(callResult.error || 'Call origination failed');
          }

          console.log(`✅ Call ${index + 1} originated: ${callResult.callId}`);

          // Log to database
          await supabase.from('call_logs').insert({
            user_id: userId,
            campaign_id: campaign.id,
            phone_number: phoneNumber,
            customer_name: customerName,
            call_id: callResult.callId,
            status: 'initiated',
            agent_id: promptId,
            caller_number: phoneNumber
          });

          return { success: true, phoneNumber, callId: callResult.callId };
        } catch (error) {
          console.error(`❌ Failed to call ${phoneNumber}:`, error);
          return { success: false, phoneNumber, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      // Wait for all calls to complete
      const results = await Promise.all(callPromises);

      const successfulCalls = results.filter(r => r.success).length;
      const failedCalls = results.filter(r => !r.success).length;

      // Update campaign status
      await supabase
        .from('campaigns')
        .update({
          status: failedCalls === phoneNumbers.length ? 'failed' : 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      console.log(`🎉 Campaign completed! Success: ${successfulCalls}, Failed: ${failedCalls}`);

      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign.id,
          summary: {
            total_calls: phoneNumbers.length,
            successful_calls: successfulCalls,
            failed_calls: failedCalls
          },
          results: results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('❌ Batch call error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Audio file endpoint - serve generated audio files
  if (url.pathname.startsWith('/audio-file/')) {
    const audioId = url.pathname.split('/audio-file/')[1];

    // Get audio from in-memory cache
    const audioData = audioCache.get(audioId);

    if (!audioData) {
      return new Response('Audio not found', { status: 404 });
    }

    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.length.toString(),
      },
    });
  }

  // WebSocket endpoint for mod_audio_fork
  if (url.pathname === '/audio' && req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);

    let callId = '';
    let userId = '';
    let campaignId = '';
    let promptId = '';
    let customerName = '';
    let audioBuffer: Uint8Array[] = [];
    let processingAudio = false;

    socket.onopen = () => {
      console.log('🎤 FreeSWITCH audio stream connected!');
    };

    socket.onmessage = async (event) => {
      try {
        // Check if message is text (metadata) or binary (audio)
        if (typeof event.data === 'string') {
          // Parse metadata from FreeSWITCH
          const metadata = JSON.parse(event.data);
          console.log('📋 Received metadata:', metadata);

          callId = metadata.call_id || '';
          userId = metadata.user_id || '';
          campaignId = metadata.campaign_id || '';
          promptId = metadata.prompt_id || '';
          customerName = metadata.customer_name || '';

          // Send acknowledgment
          socket.send(JSON.stringify({
            type: 'ready',
            message: 'AI handler ready'
          }));

          return;
        }

        // Handle binary audio data
        const audioData = new Uint8Array(await event.data.arrayBuffer());
        console.log(`📥 Received ${audioData.length} bytes of audio from FreeSWITCH`);

        // Buffer audio (collect ~1 second worth = 8000 samples * 2 bytes = 16KB)
        audioBuffer.push(audioData);

        const totalBufferSize = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

        // Process when we have enough audio (1 second)
        if (totalBufferSize >= 16000 && !processingAudio) {
          processingAudio = true;

          // Combine buffer
          const combinedBuffer = new Uint8Array(totalBufferSize);
          let offset = 0;
          for (const chunk of audioBuffer) {
            combinedBuffer.set(chunk, offset);
            offset += chunk.length;
          }

          // Clear buffer
          audioBuffer = [];

          // Process audio asynchronously
          processAudio(combinedBuffer, socket, {
            userId,
            campaignId,
            promptId,
            customerName,
            callId
          }).finally(() => {
            processingAudio = false;
          });
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    };

    socket.onclose = () => {
      console.log('📞 Call ended');
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    return response;
  }

  return new Response('FreeSWITCH AI Call Handler\nUse WebSocket at /audio', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
});

/**
 * Process audio: STT → GPT → TTS → Send back
 */
async function processAudio(
  audioData: Uint8Array,
  socket: WebSocket,
  context: {
    userId: string;
    campaignId: string;
    promptId: string;
    customerName: string;
    callId: string;
  }
) {
  try {
    console.log('🎯 Processing audio...');

    // Step 1: Convert PCM to WAV for Azure STT
    const wavData = pcmToWav(audioData, SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE);

    // Step 2: Transcribe with Azure STT
    const transcript = await transcribeWithAzure(wavData);

    if (!transcript || transcript.trim() === '') {
      console.log('🔇 No speech detected');
      return;
    }

    console.log('💬 Customer said:', transcript);

    // Step 3: Get AI response from OpenRouter
    const aiResponse = await getAIResponse(transcript, context);
    console.log('🤖 AI responds:', aiResponse);

    // Step 4: Convert to speech with ElevenLabs
    const responseAudio = await textToSpeechElevenLabs(aiResponse);
    console.log('🔊 Generated speech audio');

    // Step 5: Send audio back to FreeSWITCH
    // FreeSWITCH expects raw PCM, so convert if needed
    const pcmAudio = await convertToPCM(responseAudio, SAMPLE_RATE);

    socket.send(pcmAudio);
    console.log('📤 Sent audio back to customer');

    // Step 6: Log to database
    await logCallInteraction(context.callId, transcript, aiResponse);

  } catch (error) {
    console.error('❌ Error in processAudio:', error);
  }
}

/**
 * Convert PCM to WAV format
 */
function pcmToWav(
  pcmData: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Uint8Array {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmData.length;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const wavData = new Uint8Array(buffer);
  wavData.set(pcmData, 44);

  return wavData;
}

/**
 * Azure Speech-to-Text
 */
async function transcribeWithAzure(wavData: Uint8Array): Promise<string> {
  const azureKey = Deno.env.get('AZURE_SPEECH_KEY');
  const azureRegion = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';

  if (!azureKey) {
    throw new Error('AZURE_SPEECH_KEY not set');
  }

  const response = await fetch(
    `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'audio/wav',
      },
      body: wavData,
    }
  );

  if (!response.ok) {
    throw new Error(`Azure STT failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.DisplayText || '';
}

/**
 * Get AI response from OpenRouter
 */
async function getAIResponse(
  userMessage: string,
  context: { userId: string; promptId: string; customerName: string }
): Promise<string> {
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (!openrouterKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  // Get system prompt from database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: prompt } = await supabase
    .from('prompts')
    .select('system_prompt, first_message')
    .eq('id', context.promptId)
    .single();

  const systemPrompt = prompt?.system_prompt || 'You are a helpful AI assistant.';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content || 'I apologize, I did not understand that.';
}

/**
 * Text-to-Speech with ElevenLabs
 */
async function textToSpeechElevenLabs(text: string): Promise<Uint8Array> {
  const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL'; // Default voice

  if (!elevenLabsKey) {
    throw new Error('ELEVENLABS_API_KEY not set');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs failed: ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return new Uint8Array(audioBuffer);
}

/**
 * Convert audio to PCM format for FreeSWITCH
 */
async function convertToPCM(audioData: Uint8Array, targetSampleRate: number): Promise<Uint8Array> {
  // ElevenLabs returns MP3, need to convert to PCM
  // For now, return as-is (you may need ffmpeg or similar for conversion)
  // TODO: Implement MP3 → PCM conversion if needed
  return audioData;
}

/**
 * Log call interaction to database
 */
async function logCallInteraction(
  callId: string,
  transcript: string,
  aiResponse: string
): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('call_logs').insert({
      call_id: callId,
      transcript: transcript,
      ai_response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log interaction:', error);
  }
}

/**
 * Originate call via FreeSWITCH ESL
 * Connects to FreeSWITCH Event Socket Layer and originates call
 */
async function originateCallViaESL(params: {
  phoneNumber: string;
  extension: string;
  variables: Record<string, string>;
}): Promise<{ success: boolean; callId?: string; error?: string }> {
  const { phoneNumber, extension, variables } = params;

  const FREESWITCH_HOST = Deno.env.get('FREESWITCH_HOST') || '159.223.45.224';
  const FREESWITCH_ESL_PORT = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021');
  const FREESWITCH_ESL_PASSWORD = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

  let conn: Deno.Conn | null = null;

  try {
    // Connect to FreeSWITCH ESL
    conn = await Deno.connect({
      hostname: FREESWITCH_HOST,
      port: FREESWITCH_ESL_PORT,
    });

    console.log(`✅ Connected to FreeSWITCH ESL at ${FREESWITCH_HOST}:${FREESWITCH_ESL_PORT}`);

    // Read initial greeting
    await readESLResponse(conn);

    // Authenticate
    await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
    const authResponse = await readESLResponse(conn);

    if (!authResponse.includes('+OK')) {
      throw new Error('ESL authentication failed');
    }

    console.log('✅ ESL authenticated');

    // Clean phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Build channel variables
    const varString = Object.entries(variables)
      .map(([key, value]) => `${key}='${value}'`)
      .join(',');

    // Originate and park - we'll handle the conversation via ESL commands after answer
    const originateCmd = `api originate {${varString},origination_caller_id_number=${cleanNumber}}sofia/gateway/external::1360d030-6e0c-4617-83e0-8d80969010cf/${cleanNumber} &park()`;

    console.log(`📞 Originating: ${originateCmd}`);

    await sendESLCommand(conn, originateCmd);
    const response = await readESLResponse(conn);

    console.log(`📋 Response: ${response}`);

    // api originate returns +OK UUID on success
    // Extract UUID - can be in format "+OK <uuid>" or just the uuid
    let callId = '';

    if (response.includes('+OK')) {
      // Try to extract UUID from response
      const uuidMatch = response.match(/\+OK\s+([a-f0-9-]+)/i) || response.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      callId = uuidMatch ? uuidMatch[1] : `call_${Date.now()}`;

      console.log(`✅ Call originated successfully: ${callId}`);

      // Start AI conversation handler in background
      handleAIConversation(callId, variables).catch(err => {
        console.error(`❌ AI conversation error for ${callId}:`, err);
      });

      return {
        success: true,
        callId: callId,
      };
    } else if (response.includes('-ERR')) {
      const errorMatch = response.match(/-ERR\s+(.+)/);
      const errorMsg = errorMatch ? errorMatch[1].trim() : 'Unknown error';
      console.error(`❌ Call origination failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    } else {
      // Check if there's a UUID even without +OK
      const uuidMatch = response.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uuidMatch) {
        callId = uuidMatch[1];
        console.log(`✅ Call originated (UUID found): ${callId}`);
        return {
          success: true,
          callId: callId,
        };
      }

      console.error(`❌ Unexpected response: ${response}`);
      return {
        success: false,
        error: 'Unexpected response from FreeSWITCH',
      };
    }
  } catch (error) {
    console.error('❌ ESL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Close connection
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Handle AI conversation for a call
 * Uses record + playback loop to simulate conversation
 */
async function handleAIConversation(callId: string, variables: Record<string, string>): Promise<void> {
  const FREESWITCH_HOST = Deno.env.get('FREESWITCH_HOST') || '159.223.45.224';
  const FREESWITCH_ESL_PORT = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021');
  const FREESWITCH_ESL_PASSWORD = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

  let conn: Deno.Conn | null = null;

  try {
    // Connect to FreeSWITCH ESL
    conn = await Deno.connect({
      hostname: FREESWITCH_HOST,
      port: FREESWITCH_ESL_PORT,
    });

    // Authenticate
    await readESLResponse(conn);
    await sendESLCommand(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
    await readESLResponse(conn);

    console.log(`🤖 Starting AI conversation for call ${callId}`);

    // Wait for call to be answered
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Play greeting with ElevenLabs
    const greetingText = "Hello! This is an AI assistant. How can I help you today?";
    await playAIResponse(conn, callId, greetingText);

    // Conversation loop (simplified for now)
    for (let i = 0; i < 5; i++) {
      // Record customer speech (3 seconds max)
      console.log(`🎤 Recording customer speech... (turn ${i + 1})`);
      const recordFile = `/tmp/customer_${callId}_${i}.wav`;

      await sendESLCommand(conn, `api uuid_record ${callId} start ${recordFile} 3`);
      await readESLResponse(conn);

      // Wait for recording
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Stop recording
      await sendESLCommand(conn, `api uuid_record ${callId} stop ${recordFile}`);
      await readESLResponse(conn);

      // Process audio (STT → GPT → TTS → Play)
      // TODO: Implement full processing
      console.log(`✅ Turn ${i + 1} completed`);
    }

    console.log(`✅ AI conversation completed for ${callId}`);

  } catch (error) {
    console.error(`❌ Error in AI conversation:`, error);
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Play AI response using ElevenLabs TTS
 */
async function playAIResponse(conn: Deno.Conn, callId: string, text: string): Promise<void> {
  try {
    console.log(`🔊 Generating speech: "${text}"`);

    // Generate speech with ElevenLabs
    const audioData = await textToSpeechElevenLabs(text);

    // Store in cache with unique ID
    const audioId = `${callId}_${Date.now()}`;
    audioCache.set(audioId, audioData);

    // Build audio URL using shout:// protocol for mod_shout
    const audioUrl = `shout://sifucall.deno.dev/audio-file/${audioId}`;

    console.log(`🎵 Audio URL: ${audioUrl}`);

    // Play the audio via HTTP stream using mod_shout
    await sendESLCommand(conn, `api uuid_broadcast ${callId} ${audioUrl} both`);
    const response = await readESLResponse(conn);

    console.log(`📤 Playing AI response to customer: ${response.trim()}`);

    // Wait for playback to finish (estimate based on text length)
    const estimatedDuration = Math.max(3000, text.length * 50); // ~50ms per character
    await new Promise(resolve => setTimeout(resolve, estimatedDuration));

    // Clean up audio from cache after playback
    audioCache.delete(audioId);

  } catch (error) {
    console.error(`❌ Error playing AI response:`, error);
  }
}

/**
 * Send command to ESL
 */
async function sendESLCommand(conn: Deno.Conn, command: string): Promise<void> {
  const encoder = new TextEncoder();
  const data = encoder.encode(command + '\n\n');
  await conn.write(data);
}

/**
 * Read response from ESL
 */
async function readESLResponse(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);

  let response = '';
  let bytesRead = 0;

  // Read until we get double newline (end of ESL message)
  while (true) {
    bytesRead = await conn.read(buffer) || 0;
    if (bytesRead === 0) break;

    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    response += chunk;

    // ESL messages end with \n\n
    if (response.includes('\n\n')) {
      break;
    }

    // Timeout after 5 seconds
    if (response.length > 100000) {
      break;
    }
  }

  return response;
}
