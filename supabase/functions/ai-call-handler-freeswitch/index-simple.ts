/**
 * SIMPLIFIED AI Call Handler for FreeSWITCH + mod_audio_stream
 *
 * Based on Twilio Media Streams architecture but adapted for mod_audio_stream
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const activeCalls = new Map();

const FREESWITCH_HOST = Deno.env.get('FREESWITCH_HOST') || '159.223.45.224';
const FREESWITCH_ESL_PORT = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021');
const FREESWITCH_ESL_PASSWORD = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Batch call endpoint
  if (url.pathname === '/batch-call' && req.method === 'POST') {
    return handleBatchCall(req);
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response('WebSocket endpoint', { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      console.log(`📨 Message type: ${typeof event.data}, ArrayBuffer: ${event.data instanceof ArrayBuffer}`);

      // SIMPLIFIED: Just use database lookup on FIRST message
      // Don't try to detect metadata - it's unreliable

      let session = findSession(socket);
      console.log(`🔍 Session: ${session ? 'EXISTS' : 'NULL'}, initialized: ${socket.initialized || 'false'}`);

      if (!session && !socket.initialized) {
        socket.initialized = true;
        console.log('🔧 Initializing session from database...');

        // Get most recent initiated call
        const { data: call, error: dbError } = await supabaseAdmin
          .from('call_logs')
          .select('call_id, user_id, campaign_id, campaigns(prompt_id)')
          .eq('status', 'initiated')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (dbError) {
          console.error('❌ Database error:', dbError);
          return;
        }

        if (call) {
          console.log(`✅ Found call: ${call.call_id}`);

          // Send response to FreeSWITCH
          socket.send(JSON.stringify({ audioDataType: "raw", sampleRate: 8000 }));
          console.log('📤 Sent response to FreeSWITCH');

          // Create session
          await initializeSession(socket, call);
          session = findSession(socket);
          console.log(`✅ Session initialized: ${session ? 'YES' : 'NO'}`);
        } else {
          console.log('❌ No call found in database');
          return;
        }
      }

      // Process audio
      if (session && event.data instanceof ArrayBuffer) {
        await processAudio(session, event.data);
      } else if (!session) {
        console.log('⚠️ No session yet, ignoring packet');
      }

    } catch (error) {
      console.error("❌ FATAL ERROR:", error);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      }
    }
  };

  socket.onclose = () => console.log("📞 Call ended");
  socket.onerror = (e) => console.error("❌ WebSocket error:", e);

  return response;
});

function findSession(socket: WebSocket) {
  for (const [_, sess] of activeCalls.entries()) {
    if (sess.socket === socket) return sess;
  }
  return null;
}

async function initializeSession(socket: WebSocket, callData: any) {
  const { call_id, user_id, campaign_id, campaigns } = callData;

  // Get prompts
  let systemPrompt = "You are a helpful AI assistant.";
  let firstMessage = "Hello! How can I help you?";
  let voiceId = "UcqZLa941Kkt8ZhEEybf";

  if (campaigns?.prompt_id && user_id) {
    const { data: prompt } = await supabaseAdmin
      .from('prompts')
      .select('system_prompt, first_message')
      .eq('id', campaigns.prompt_id)
      .eq('user_id', user_id)
      .single();

    if (prompt) {
      systemPrompt = prompt.system_prompt;
      firstMessage = prompt.first_message;
    }
  }

  // Get voice config
  if (user_id) {
    const { data: voice } = await supabaseAdmin
      .from('voice_config')
      .select('manual_voice_id, speed')
      .eq('user_id', user_id)
      .maybeSingle();

    if (voice?.manual_voice_id) voiceId = voice.manual_voice_id;
  }

  const session = {
    callId: call_id,
    userId: user_id,
    socket,
    voiceId,
    systemPrompt,
    conversationHistory: [{ role: 'system', content: systemPrompt }],
    audioBuffer: [],
    isProcessing: false,
  };

  activeCalls.set(call_id, session);

  // Update database
  await supabaseAdmin
    .from('call_logs')
    .update({ status: 'connected' })
    .eq('call_id', call_id);

  console.log(`💬 Session created for ${call_id}`);
  console.log(`🔊 Speaking first message: "${firstMessage}"`);

  // Send first message
  await speak(session, firstMessage);
}

async function processAudio(session: any, audioData: ArrayBuffer) {
  if (session.isProcessing) return;

  // Buffer audio (mod_audio_stream sends L16 PCM at 8kHz)
  session.audioBuffer.push(new Uint8Array(audioData));

  // Process every 1 second (8000 Hz * 2 bytes = 16000 bytes)
  const totalSize = session.audioBuffer.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);

  if (totalSize >= 16000) {
    session.isProcessing = true;

    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of session.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    session.audioBuffer = [];

    await transcribe(session, combined);
    session.isProcessing = false;
  }
}

async function transcribe(session: any, pcmBytes: Uint8Array) {
  if (pcmBytes.length < 1200) return;

  console.log(`🎙️ Transcribing ${pcmBytes.length} bytes...`);

  // Create WAV header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, pcmBytes.length + 36, true);
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
  view.setUint32(40, pcmBytes.length, true);

  const wavFile = new Uint8Array(44 + pcmBytes.length);
  wavFile.set(new Uint8Array(header), 0);
  wavFile.set(pcmBytes, 44);

  // Azure STT
  const res = await fetch(
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

  if (!res.ok) return;

  const result = await res.json();

  if (result.RecognitionStatus === 'Success' && result.DisplayText) {
    const text = result.DisplayText.trim();
    if (text.length > 0) {
      console.log(`🗣️ Customer: "${text}"`);
      session.conversationHistory.push({ role: 'user', content: text });
      await getAIResponse(session, text);
    }
  }
}

async function getAIResponse(session: any, userMessage: string) {
  console.log("🤖 Getting AI response...");

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

  const data = await res.json();
  const aiResponse = data.choices[0]?.message?.content;

  if (aiResponse) {
    console.log(`💬 AI: "${aiResponse}"`);
    session.conversationHistory.push({ role: 'assistant', content: aiResponse });
    await speak(session, aiResponse);
  }
}

async function speak(session: any, text: string) {
  console.log(`🔊 Speaking: "${text}"`);

  // Get PCM from ElevenLabs
  const res = await fetch(
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
        voice_settings: { stability: 0.5, similarity_boost: 1.0 },
      }),
    }
  );

  const pcmBuffer = await res.arrayBuffer();
  const pcm16k = new Int16Array(pcmBuffer);

  // Downsample 16kHz → 8kHz
  const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = pcm16k[i * 2];
  }

  // Convert to base64
  const pcmBytes = new Uint8Array(pcm8k.buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < pcmBytes.length; i += chunkSize) {
    const chunk = pcmBytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64Audio = btoa(binary);

  // Send to FreeSWITCH
  if (session.socket.readyState === WebSocket.OPEN) {
    session.socket.send(JSON.stringify({
      type: "streamAudio",
      data: {
        audioDataType: "raw",
        sampleRate: 8000,
        audioData: base64Audio
      }
    }));
    console.log("✅ Audio sent!");
  }
}

// Batch call handler
async function handleBatchCall(req: Request): Promise<Response> {
  try {
    const { userId, campaignName, promptId, phoneNumbers } = await req.json();

    if (!userId || !phoneNumbers) {
      throw new Error('Missing userId or phoneNumbers');
    }

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
      throw new Error('Failed to create campaign');
    }

    const WEBSOCKET_URL = `wss://${req.headers.get('host')}`;

    // Process calls
    const results = await Promise.all(phoneNumbers.map(async (phoneNumber: string) => {
      try {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const callId = await originateCall(cleanNumber, userId, campaign.id, prompt.id, WEBSOCKET_URL);

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
      summary: { total: phoneNumbers.length, successful: successCount, failed: failedCount },
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

// Originate call via FreeSWITCH ESL
async function originateCall(phoneNumber: string, userId: string, campaignId: string, promptId: string, websocketUrl: string): Promise<string> {
  const conn = await Deno.connect({
    hostname: FREESWITCH_HOST,
    port: FREESWITCH_ESL_PORT,
  });

  // Authenticate
  await readESL(conn);
  await sendESL(conn, `auth ${FREESWITCH_ESL_PASSWORD}`);
  await readESL(conn);

  // Originate and park
  const vars = `user_id=${userId},campaign_id=${campaignId},prompt_id=${promptId}`;
  const cmd = `api originate {${vars}}sofia/gateway/external::1360d030-6e0c-4617-83e0-8d80969010cf/${phoneNumber} &park()`;

  await sendESL(conn, cmd);
  const response = await readESL(conn);

  const uuidMatch = response.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!uuidMatch) {
    conn.close();
    throw new Error('Failed to get call UUID');
  }

  const callId = uuidMatch[1];

  // Start audio stream
  const metadata = JSON.stringify({ call_id: callId, user_id: userId, campaign_id: campaignId, prompt_id: promptId, phone_number: phoneNumber });
  const streamCmd = `api uuid_audio_stream ${callId} start ${websocketUrl} mono 8k ${metadata}`;

  await sendESL(conn, streamCmd);
  await readESL(conn);
  conn.close();

  return callId;
}

// ESL helpers
async function sendESL(conn: Deno.Conn, command: string): Promise<void> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(command + '\n\n'));
}

async function readESL(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);
  let response = '';

  while (true) {
    const bytesRead = await conn.read(buffer) || 0;
    if (bytesRead === 0) break;

    response += decoder.decode(buffer.subarray(0, bytesRead));

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
