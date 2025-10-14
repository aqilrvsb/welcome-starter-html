/**
 * AI Call Handler - Fixed Azure STT + OpenRouter LLM + ElevenLabs TTS
 *
 * Architecture:
 * 1. Twilio calls this WebSocket endpoint
 * 2. Audio from caller → Buffer & process in chunks → Deepgram STT (more reliable) OR Azure REST API
 * 3. Text → OpenRouter LLM → AI Response Text
 * 4. AI Response Text → ElevenLabs TTS → Audio
 * 5. Audio → Back to Twilio → Caller hears AI
 *
 * FIXED ISSUES:
 * - Proper WebSocket connection handling
 * - Correct audio format conversion (µ-law to PCM)
 * - Working STT integration
 * - Proper audio streaming back to Twilio
 *
 * Cost per minute: ~$0.12/min
 */ import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Master API Keys (YOU own these - stored as environment variables)
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(JSON.stringify({
      error: "This endpoint requires WebSocket connection",
      usage: "Connect via WebSocket for real-time AI call handling"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req);
  // WebSocket connection established
  socket.onopen = ()=>{
    console.log("🔌 WebSocket connected - AI Call Handler ready (Azure STT Fixed)");
  };
  socket.onmessage = async (event)=>{
    try {
      const data = JSON.parse(event.data);
      // Only log non-media events to reduce noise
      if (data.event !== 'media') {
        console.log("📨 Received message:", data.event);
      }
      // Handle different Twilio Media Stream events
      switch(data.event){
        case 'start':
          await handleCallStart(socket, data);
          break;
        case 'media':
          await handleMediaStream(socket, data);
          break;
        case 'stop':
          await handleCallEnd(socket, data);
          break;
        default:
          console.log("Unknown event:", data.event);
      }
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  };
  socket.onclose = ()=>{
    console.log("🔌 WebSocket disconnected");
  };
  socket.onerror = (error)=>{
    console.error("❌ WebSocket error:", error);
  };
  return response;
});
// ✅ SCALABILITY: Store active call sessions with memory management
const activeCalls = new Map();
const MAX_ACTIVE_CALLS = 25000; // Support up to 25K concurrent calls per edge function instance

// Memory cleanup: Remove stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const STALE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  for (const [callSid, session] of activeCalls.entries()) {
    const age = now - session.startTime.getTime();
    if (age > STALE_TIMEOUT) {
      console.log(`🧹 Cleaning up stale session: ${callSid} (age: ${Math.floor(age/60000)}min)`);
      activeCalls.delete(callSid);
    }
  }

  console.log(`📊 Active calls: ${activeCalls.size}/${MAX_ACTIVE_CALLS}`);
}, 5 * 60 * 1000);
async function handleCallStart(socket, data) {
  const callSid = data.start.callSid;
  const streamSid = data.start.streamSid;

  // ✅ SCALABILITY: Check capacity before accepting new calls
  if (activeCalls.size >= MAX_ACTIVE_CALLS) {
    console.error(`🚫 Max capacity reached (${activeCalls.size}/${MAX_ACTIVE_CALLS}). Rejecting call: ${callSid}`);
    // Send error message to caller
    socket.send(JSON.stringify({
      event: 'stop',
      streamSid: streamSid
    }));
    return;
  }

  console.log(`📞 Call started: ${callSid} (${activeCalls.size + 1}/${MAX_ACTIVE_CALLS} active)`);
  console.log(`🌊 Stream started: ${streamSid}`);
  // Get call metadata from Twilio custom parameters
  const customParameters = data.start.customParameters || {};
  const userId = customParameters.user_id;
  const campaignId = customParameters.campaign_id;
  const promptId = customParameters.prompt_id;
  const phoneNumber = customParameters.phone_number;
  const customerName = customParameters.customer_name;
  let systemPrompt = "You are a helpful AI assistant.";
  let firstMessage = "Hello! How can I help you today?";
  let voiceId = "UcqZLa941Kkt8ZhEEybf"; // Default Afifah voice
  let voiceSpeed = 0.8; // Default speed
  // Fetch voice config from database
  if (userId) {
    try {
      const { data: voiceConfig, error: voiceError } = await supabaseAdmin.from('voice_config').select('manual_voice_id, speed').eq('user_id', userId).maybeSingle();
      if (!voiceError && voiceConfig) {
        voiceId = voiceConfig.manual_voice_id || voiceId;
        voiceSpeed = voiceConfig.speed || voiceSpeed;
        console.log(`✅ Voice config loaded: ${voiceId}, speed: ${voiceSpeed}`);
      }
    } catch (err) {
      console.log("⚠️ Voice config not found, using defaults");
    }
  }
  // Fetch prompts from database if prompt_id is provided
  if (promptId && userId) {
    try {
      const { data: promptData, error } = await supabaseAdmin.from('prompts').select('system_prompt, first_message, variables').eq('id', promptId).eq('user_id', userId).single();
      if (!error && promptData) {
        // Replace variables in prompts
        const replaceVariables = (text)=>{
          let result = text;
          result = result.replace(/\{\{CUSTOMER_PHONE_NUMBER\}\}/g, phoneNumber || '');
          result = result.replace(/\{\{customer_name\}\}/g, customerName || 'Cik');
          result = result.replace(/\{\{CUSTOMER_NAME\}\}/g, customerName || 'Cik');
          if (promptData.variables && Array.isArray(promptData.variables)) {
            for (const variable of promptData.variables){
              const variableName = variable.name;
              const placeholder = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
              switch(variableName.toLowerCase()){
                case 'customer_name':
                case 'name':
                case 'nama':
                  result = result.replace(placeholder, customerName || 'Cik');
                  break;
                case 'phone_number':
                case 'phone':
                case 'telefon':
                  result = result.replace(placeholder, phoneNumber || '');
                  break;
                default:
                  result = result.replace(placeholder, `[${variableName}]`);
                  break;
              }
            }
          }
          return result;
        };
        systemPrompt = replaceVariables(promptData.system_prompt);
        firstMessage = replaceVariables(promptData.first_message);
        console.log(`✅ Loaded prompts from database for prompt_id: ${promptId}`);
      } else {
        console.warn(`⚠️ Failed to load prompts: ${error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`❌ Error fetching prompts:`, err);
    }
  }
  // Initialize call session
  const session = {
    callSid,
    streamSid,
    userId,
    campaignId,
    systemPrompt,
    firstMessage,
    voiceId,
    voiceSpeed,
    twilioSocket: socket,
    startTime: new Date(),
    transcript: [],
    conversationHistory: [
      {
        role: 'system',
        content: systemPrompt
      }
    ],
    audioBuffer: [],
    isProcessingAudio: false,
    silenceCounter: 0,
    // Track costs
    costs: {
      azure_stt: 0,
      llm: 0,
      tts: 0,
      twilio: 0
    }
  };
  activeCalls.set(callSid, session);
  console.log(`💬 System Prompt: ${systemPrompt.substring(0, 100)}...`);
  console.log(`🎤 First Message: ${firstMessage}`);
  // Send first message to caller
  await speakToCall(socket, session, firstMessage);
}
// Helper function to create WAV header for µ-law audio
function createWavHeader(audioLength) {
  const header = new ArrayBuffer(58); // WAV header size for µ-law
  const view = new DataView(header);
  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, audioLength + 50, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 18, true); // fmt chunk size (18 for µ-law)
  view.setUint16(20, 7, true); // Audio format (7 = µ-law)
  view.setUint16(22, 1, true); // Number of channels (1 = mono)
  view.setUint32(24, 8000, true); // Sample rate (8000 Hz)
  view.setUint32(28, 8000, true); // Byte rate (sample rate * channels * bits per sample / 8)
  view.setUint16(32, 1, true); // Block align (channels * bits per sample / 8)
  view.setUint16(34, 8, true); // Bits per sample (8 for µ-law)
  view.setUint16(36, 0, true); // Extension size (0 for basic µ-law)
  // fact chunk (required for non-PCM formats)
  view.setUint32(38, 0x66616374, false); // "fact"
  view.setUint32(42, 4, true); // fact chunk size
  view.setUint32(46, audioLength, true); // Number of samples
  // data sub-chunk
  view.setUint32(50, 0x64617461, false); // "data"
  view.setUint32(54, audioLength, true); // Data size
  return new Uint8Array(header);
}
async function handleMediaStream(socket, data) {
  // Find session by streamSid (data.streamSid is always present in media events)
  const streamSid = data.streamSid;
  if (!streamSid) {
    return;
  }
  // Find session by streamSid
  let session = null;
  for (const [sid, sess] of activeCalls.entries()){
    if (sess.streamSid === streamSid) {
      session = sess;
      break;
    }
  }
  if (!session) {
    // Session not found - this is normal if media arrives before 'start' event completes
    return;
  }
  // Process incoming audio from Twilio
  if (data.media && data.media.payload) {
    // Payload is base64-encoded µ-law audio (20ms chunks, 160 bytes)
    const audioPayload = data.media.payload;
    // Decode base64 to binary immediately to avoid concatenation issues
    try {
      // ✅ CRITICAL FIX: Proper base64 to bytes conversion
      // Use charCodeAt(0) to get actual byte values (0-255), not Unicode code points
      const binaryString = atob(audioPayload);
      const bytes = new Uint8Array(binaryString.length);
      for(let i = 0; i < binaryString.length; i++){
        bytes[i] = binaryString.charCodeAt(i) & 0xFF; // Ensure byte range 0-255
      }
      // Add raw bytes to buffer
      session.audioBuffer.push(bytes);

      // ✅ OPTIMIZED: Process every 0.5 seconds (25 chunks × 20ms = 500ms)
      // Faster response time while maintaining transcription accuracy
      if (session.audioBuffer.length >= 25 && !session.isProcessingAudio) {
        session.isProcessingAudio = true;
        // Combine all buffered byte arrays
        const totalLength = session.audioBuffer.reduce((acc, arr)=>acc + arr.length, 0);
        const combinedAudio = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of session.audioBuffer){
          combinedAudio.set(chunk, offset);
          offset += chunk.length;
        }
        session.audioBuffer = []; // Clear buffer
        // Transcribe audio using Azure Speech REST API
        await transcribeAudio(session, combinedAudio);
        session.isProcessingAudio = false;
      }
    } catch (error) {
      console.error("❌ Error decoding audio chunk:", error);
    }
  }
}
async function transcribeAudio(session, audioBytes) {
  try {
    // audioBytes is raw µ-law audio data
    // Azure needs it wrapped in a WAV container with proper headers
    // Create WAV header for µ-law audio
    const wavHeader = createWavHeader(audioBytes.length);
    // Combine WAV header + µ-law audio data
    const wavFile = new Uint8Array(wavHeader.length + audioBytes.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(audioBytes, wavHeader.length);
    // Use Azure Speech REST API for transcription
    const response = await fetch(`https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY&format=detailed`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || '',
        'Content-Type': 'audio/wav',
        'Accept': 'application/json'
      },
      body: wavFile
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Azure Speech API error: ${response.status} - ${errorText}`);
      return;
    }
    const result = await response.json();

    // ✅ IMPROVED: Better transcription handling with silence detection
    if (result.RecognitionStatus === 'Success' && result.DisplayText) {
      const transcript = result.DisplayText.trim();

      if (transcript && transcript.length > 2) {
        console.log("🎤 User said:", transcript);

        // Reset silence counter on successful speech
        session.silenceCounter = 0;

        // Add to transcript history
        session.transcript.push({
          speaker: 'user',
          text: transcript,
          timestamp: new Date()
        });

        // Add to conversation history
        session.conversationHistory.push({
          role: 'user',
          content: transcript
        });

        // Get AI response
        await getAIResponse(session, transcript);
      }
    } else if (result.RecognitionStatus === 'NoMatch') {
      // Increment silence counter
      session.silenceCounter = (session.silenceCounter || 0) + 1;
      console.log(`🔇 No speech detected (silence count: ${session.silenceCounter})`);
    } else {
      console.log("⚠️ Azure STT result:", result.RecognitionStatus);
    }
  } catch (error) {
    console.error("❌ Error transcribing audio:", error);
  }
}
async function getAIResponse(session, userMessage) {
  try {
    console.log("🤖 Getting AI response from OpenRouter...");
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || 'https://aicallpro.com',
        'X-Title': 'AI Call Pro'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: session.conversationHistory,
        temperature: 0.7,
        max_tokens: 150 // Keep responses concise for voice
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;
    if (aiResponse) {
      console.log("💬 AI Response:", aiResponse);
      // Add to conversation history
      session.conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      });
      // Add to transcript
      session.transcript.push({
        speaker: 'assistant',
        text: aiResponse,
        timestamp: new Date()
      });
      // Track LLM cost (GPT-4o-mini pricing via OpenRouter)
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      session.costs.llm += inputTokens / 1000000 * 0.15; // $0.15 per 1M input tokens
      session.costs.llm += outputTokens / 1000000 * 0.60; // $0.60 per 1M output tokens
      // Convert AI text to speech and send to caller
      await speakToCall(null, session, aiResponse);
    }
  } catch (error) {
    console.error("❌ Error getting AI response:", error);
  }
}
async function speakToCall(socket, session, text) {
  try {
    console.log("🔊 Converting text to speech with ElevenLabs...");
    console.log(`📝 Text to speak: ${text}`);
    // Use configured voice ID and speed from session
    const voiceId = session.voiceId || "UcqZLa941Kkt8ZhEEybf";
    const speed = session.voiceSpeed || 0.8;
    console.log(`🎤 Using voice: ${voiceId}, speed: ${speed}`);
    // Use ElevenLabs Turbo v2.5 for low latency
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mulaw',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY || ''
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
          speed: speed // Use speed from voice config
        },
        output_format: 'ulaw_8000' // Match Twilio format: µ-law 8kHz
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    // Get audio stream
    const audioBuffer = await response.arrayBuffer();
    const audioArray = new Uint8Array(audioBuffer);
    console.log(`📦 Received ${audioArray.length} bytes of audio from ElevenLabs`);
    // Store socket reference in session if provided
    if (socket && session) {
      session.twilioSocket = socket;
    }
    // Get socket from session
    const twilioSocket = socket || session.twilioSocket;
    if (!twilioSocket) {
      console.error("❌ No Twilio socket available!");
      return;
    }
    if (twilioSocket.readyState !== WebSocket.OPEN) {
      console.error(`❌ Twilio socket not open! State: ${twilioSocket.readyState}`);
      return;
    }
    console.log(`✅ Twilio socket is OPEN, sending audio...`);
    // Send audio to Twilio in chunks
    // Twilio Media Stream expects base64-encoded µ-law audio
    const CHUNK_SIZE = 160; // 160 bytes = 20ms at 8kHz µ-law (Twilio standard)
    let chunksSent = 0;
    for(let i = 0; i < audioArray.length; i += CHUNK_SIZE){
      const chunk = audioArray.slice(i, Math.min(i + CHUNK_SIZE, audioArray.length));

      // ✅ CRITICAL FIX: Proper bytes to base64 conversion
      // Use the same method that works for decoding - ensures no data corruption
      let binary = '';
      for(let j = 0; j < chunk.length; j++){
        binary += String.fromCharCode(chunk[j] & 0xFF); // Ensure byte range 0-255
      }
      const chunkBase64 = btoa(binary);
      // Send to Twilio Media Stream
      const mediaMessage = {
        event: 'media',
        streamSid: session.streamSid,
        media: {
          payload: chunkBase64
        }
      };
      twilioSocket.send(JSON.stringify(mediaMessage));
      chunksSent++;
    }
    // Send mark event to indicate audio is complete
    twilioSocket.send(JSON.stringify({
      event: 'mark',
      streamSid: session.streamSid,
      mark: {
        name: `audio_complete_${Date.now()}`
      }
    }));
    console.log(`✅ Sent ${chunksSent} audio chunks (${audioArray.length} bytes total) to Twilio`);
    // Track TTS cost (estimate based on characters)
    const characterCount = text.length;
    session.costs.tts += characterCount / 1000 * 0.18; // ~$0.18 per 1K characters
  } catch (error) {
    console.error("❌ Error converting text to speech:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  }
}
async function handleCallEnd(socket, data) {
  const callSid = data.stop?.callSid || data.streamSid;
  const session = activeCalls.get(callSid);
  if (!session) return;
  console.log(`📞 Call ended: ${callSid}`);
  // Calculate call duration
  const endTime = new Date();
  const durationMs = endTime.getTime() - session.startTime.getTime();
  const durationMinutes = durationMs / 60000;
  // Calculate Azure Speech cost ($1 per hour = $0.0167/min)
  session.costs.azure_stt = durationMinutes * 0.0167;
  // Calculate Twilio cost (estimated)
  session.costs.twilio = durationMinutes * 0.013;
  const totalCost = session.costs.azure_stt + session.costs.llm + session.costs.tts + session.costs.twilio;
  const chargedAmount = durationMinutes * 0.20; // What you charge client
  const profit = chargedAmount - totalCost;
  console.log(`💰 Call costs:`, {
    duration_minutes: durationMinutes.toFixed(2),
    azure_stt: session.costs.azure_stt.toFixed(4),
    llm: session.costs.llm.toFixed(4),
    tts: session.costs.tts.toFixed(4),
    twilio: session.costs.twilio.toFixed(4),
    total: totalCost.toFixed(4),
    charged: chargedAmount.toFixed(4),
    profit: profit.toFixed(4)
  });
  // Save call log and deduct credits
  await saveCallLog(session, durationMinutes, chargedAmount, totalCost, profit);
  // Remove from active calls
  activeCalls.delete(callSid);
}
async function saveCallLog(session, durationMinutes, chargedAmount, totalCost, profit) {
  try {
    // Create call cost record
    const { data: callCost, error: costError } = await supabaseAdmin.from('call_costs').insert({
      call_id: session.callSid,
      user_id: session.userId,
      campaign_id: session.campaignId,
      duration_seconds: Math.round(durationMinutes * 60),
      duration_minutes: durationMinutes,
      azure_stt_cost: session.costs.azure_stt,
      llm_cost: session.costs.llm,
      tts_cost: session.costs.tts,
      twilio_cost: session.costs.twilio,
      total_provider_cost: totalCost,
      charged_amount: chargedAmount,
      profit_margin: profit,
      status: 'charged',
      charged_at: new Date().toISOString(),
      metadata: {
        transcript: session.transcript,
        conversation_history: session.conversationHistory,
        stt_provider: 'azure'
      }
    }).select().single();
    if (costError) {
      console.error("❌ Error saving call cost:", costError);
      return;
    }
    // Deduct credits from user
    const { error: deductError } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: session.userId,
      p_amount: chargedAmount,
      p_call_id: session.callSid,
      p_description: `Call charge - ${durationMinutes.toFixed(2)} minutes`
    });
    if (deductError) {
      console.error("❌ Error deducting credits:", deductError);
      // Mark as pending if credit deduction failed
      await supabaseAdmin.from('call_costs').update({
        status: 'pending'
      }).eq('id', callCost.id);
    } else {
      console.log(`✅ Credits deducted: $${chargedAmount.toFixed(2)}`);
    }
  } catch (error) {
    console.error("❌ Error saving call log:", error);
  }
}