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

  // Build originate command with mod_audio_stream
  const vars = [
    `user_id=${userId}`,
    `campaign_id=${campaignId}`,
    `prompt_id=${promptId}`,
    `origination_caller_id_number=${phoneNumber}`,
  ].join(',');

  // Use mod_audio_stream to stream audio to WebSocket
  const originateCmd = `api originate {${vars}}sofia/gateway/external::1360d030-6e0c-4617-83e0-8d80969010cf/${phoneNumber} &audio_stream(${websocketUrl},L16)`;

  console.log(`📞 Originating: ${originateCmd}`);

  await sendESLCommand(conn, originateCmd);
  const response = await readESLResponse(conn);

  console.log(`📋 Response: ${response}`);

  const uuidMatch = response.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  const callId = uuidMatch ? uuidMatch[1] : `call_${Date.now()}`;

  conn.close();

  return callId;
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
    costs: { azure_stt: 0, llm: 0, tts: 0 },
  };

  activeCalls.set(callId, session);

  // Send first message
  await speakToCall(session, firstMessage);
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

  if (!session || session.isProcessingAudio || session.isSpeaking) return;

  // Convert to Uint8Array (mod_audio_stream sends L16/PCM)
  const pcmData = new Uint8Array(audioData);
  session.audioBuffer.push(pcmData);

  // Process every ~1 second
  const totalSize = session.audioBuffer.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  if (totalSize >= 16000) {
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
    if (audioBytes.length < 1200) return;

    console.log(`🎙️ Transcribing ${audioBytes.length} bytes...`);

    // Create WAV file
    const wavHeader = createWavHeader(audioBytes.length);
    const wavFile = new Uint8Array(wavHeader.length + audioBytes.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(audioBytes, wavHeader.length);

    // Azure STT
    const response = await fetch(
      `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || '',
          'Content-Type': 'audio/wav',
        },
        body: wavFile,
      }
    );

    if (!response.ok) return;

    const result = await response.json();

    if (result.RecognitionStatus === 'Success' && result.DisplayText) {
      const transcript = result.DisplayText.trim();
      if (transcript.length > 0) {
        console.log(`🗣️  Customer: "${transcript}"`);

        session.transcript.push({ speaker: 'user', text: transcript, timestamp: new Date() });
        session.conversationHistory.push({ role: 'user', content: transcript });

        await getAIResponse(session, transcript);
      }
    }
  } catch (error) {
    console.error("❌ Transcription error:", error);
  }
}

async function getAIResponse(session: any, userMessage: string) {
  try {
    console.log("🤖 Getting AI response...");

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

      await speakToCall(session, aiResponse);
    }
  } catch (error) {
    console.error("❌ AI error:", error);
  }
}

// G.711 µ-law encoding (SAME AS TWILIO!)
function pcmToMulaw(pcm: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;

  const sign = (pcm < 0) ? 0x80 : 0x00;
  let magnitude = Math.abs(pcm);

  if (magnitude > MULAW_MAX) magnitude = MULAW_MAX;
  magnitude += MULAW_BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (magnitude & mask) === 0 && exponent > 0; exponent--, mask >>= 1);

  const mantissa = (magnitude >> (exponent + 3)) & 0x0F;

  return (~(sign | (exponent << 4) | mantissa)) & 0xFF;
}

async function speakToCall(session: any, text: string) {
  try {
    session.isSpeaking = true;

    console.log(`🔊 Speaking: "${text}"`);

    // Get PCM from ElevenLabs (SAME AS TWILIO!)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${session.voiceId}?output_format=pcm_24000`,
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
    const pcm24k = new Int16Array(pcmBuffer);

    // Downsample to 8kHz + convert to µ-law (SAME AS TWILIO!)
    const audioArray = new Uint8Array(Math.floor(pcm24k.length / 3));
    for (let i = 0; i < audioArray.length; i++) {
      audioArray[i] = pcmToMulaw(pcm24k[i * 3]);
    }

    console.log(`📦 Sending ${audioArray.length} bytes of audio...`);

    // Send audio via WebSocket (SAME AS TWILIO!)
    // mod_audio_stream expects raw µ-law bytes
    if (session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(audioArray);
      console.log("✅ Audio sent to FreeSWITCH!");
    }

    session.isSpeaking = false;
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
