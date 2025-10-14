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
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master API Keys (YOU own these - stored as environment variables)
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({
        error: "This endpoint requires WebSocket connection",
        usage: "Connect via WebSocket for real-time AI call handling"
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req);

  // WebSocket connection established
  socket.onopen = () => {
    console.log("🔌 WebSocket connected - AI Call Handler ready (Deepgram STT)");
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Only log non-media events to reduce noise
      if (data.event !== 'media') {
        console.log("📨 Received message:", data.event);
      }

      // Handle different Twilio Media Stream events
      switch (data.event) {
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

  socket.onclose = () => {
    console.log("🔌 WebSocket disconnected");
  };

  socket.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
  };

  return response;
});

// Store active call sessions
const activeCalls = new Map();

async function handleCallStart(socket: WebSocket, data: any) {
  const callSid = data.start.callSid;
  const streamSid = data.start.streamSid;

  console.log(`📞 Call started: ${callSid}`);
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
      const { data: voiceConfig, error: voiceError } = await supabaseAdmin
        .from('voice_config')
        .select('manual_voice_id, speed')
        .eq('user_id', userId)
        .maybeSingle();

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
      const { data: promptData, error } = await supabaseAdmin
        .from('prompts')
        .select('system_prompt, first_message, variables')
        .eq('id', promptId)
        .eq('user_id', userId)
        .single();

      if (!error && promptData) {
        // Replace variables in prompts
        const replaceVariables = (text: string) => {
          let result = text;
          result = result.replace(/\{\{CUSTOMER_PHONE_NUMBER\}\}/g, phoneNumber || '');
          result = result.replace(/\{\{customer_name\}\}/g, customerName || 'Cik');
          result = result.replace(/\{\{CUSTOMER_NAME\}\}/g, customerName || 'Cik');

          if (promptData.variables && Array.isArray(promptData.variables)) {
            for (const variable of promptData.variables) {
              const variableName = variable.name;
              const placeholder = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');

              switch (variableName.toLowerCase()) {
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

  // Create Deepgram WebSocket connection for this call
  const deepgramSocket = await createDeepgramConnection();

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
    twilioSocket: socket, // Store Twilio WebSocket for sending audio
    deepgramSocket, // Store Deepgram WebSocket for STT
    startTime: new Date(),
    transcript: [],
    conversationHistory: [
      { role: 'system', content: systemPrompt }
    ],
    currentUtterance: '', // Buffer for building up the current utterance

    // Track costs
    costs: {
      deepgram_stt: 0,
      llm: 0,
      tts: 0,
      twilio: 0
    }
  };

  activeCalls.set(callSid, session);

  // Set up Deepgram message handler
  setupDeepgramHandlers(session);

  console.log(`💬 System Prompt: ${systemPrompt.substring(0, 100)}...`);
  console.log(`🎤 First Message: ${firstMessage}`);

  // Send first message to caller
  await speakToCall(socket, session, firstMessage);
}

// Create Deepgram WebSocket connection
async function createDeepgramConnection(): Promise<WebSocket> {
  // Deepgram supports passing API key as query parameter for WebSocket
  const url = `wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&language=ms&punctuate=true&interim_results=false&token=${DEEPGRAM_API_KEY}`;
  
  const deepgramSocket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    deepgramSocket.onopen = () => {
      console.log("🎤 Deepgram connection established");
      resolve(deepgramSocket);
    };

    deepgramSocket.onerror = (error) => {
      console.error("❌ Deepgram connection error:", error);
      reject(error);
    };
  });
}

// Set up Deepgram message handlers
function setupDeepgramHandlers(session: any) {
  session.deepgramSocket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        
        if (transcript && transcript.trim().length > 0) {
          const isFinal = data.is_final;
          
          if (isFinal) {
            console.log("🎤 User said:", transcript);
            
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
            getAIResponse(session, transcript);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error processing Deepgram message:", error);
    }
  };

  session.deepgramSocket.onerror = (error: Event) => {
    console.error("❌ Deepgram WebSocket error:", error);
  };

  session.deepgramSocket.onclose = () => {
    console.log("🔌 Deepgram connection closed");
  };
}

async function handleMediaStream(socket: WebSocket, data: any) {
  // Find session by streamSid (data.streamSid is always present in media events)
  const streamSid = data.streamSid;
  
  if (!streamSid) {
    return;
  }

  // Find session by streamSid
  let session = null;
  for (const [sid, sess] of activeCalls.entries()) {
    if (sess.streamSid === streamSid) {
      session = sess;
      break;
    }
  }

  if (!session) {
    // Session not found - this is normal if media arrives before 'start' event completes
    return;
  }

  // Process incoming audio from Twilio - stream directly to Deepgram
  if (data.media && data.media.payload) {
    // Payload is base64-encoded µ-law audio (20ms chunks, 160 bytes)
    const audioPayload = data.media.payload;

    try {
      // Decode base64 to binary
      const binaryString = atob(audioPayload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Stream audio directly to Deepgram (it handles µ-law natively)
      if (session.deepgramSocket && session.deepgramSocket.readyState === WebSocket.OPEN) {
        session.deepgramSocket.send(bytes);
      }
    } catch (error) {
      console.error("❌ Error processing audio chunk:", error);
    }
  }
}

// Deepgram transcription is handled via WebSocket callbacks in setupDeepgramHandlers()
// No separate transcribeAudio function needed

async function getAIResponse(session: any, userMessage: string) {
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
        model: 'openai/gpt-4o-mini', // GPT-4o-mini via OpenRouter
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
      session.costs.llm += (inputTokens / 1000000) * 0.15; // $0.15 per 1M input tokens
      session.costs.llm += (outputTokens / 1000000) * 0.60; // $0.60 per 1M output tokens

      // Convert AI text to speech and send to caller
      await speakToCall(null, session, aiResponse);
    }

  } catch (error) {
    console.error("❌ Error getting AI response:", error);
  }
}

async function speakToCall(socket: WebSocket | null, session: any, text: string) {
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
    const CHUNK_SIZE = 640; // 640 bytes = ~80ms at 8kHz µ-law
    let chunksSent = 0;

    for (let i = 0; i < audioArray.length; i += CHUNK_SIZE) {
      const chunk = audioArray.slice(i, Math.min(i + CHUNK_SIZE, audioArray.length));

      // Convert chunk to base64
      let binary = '';
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
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
    session.costs.tts += (characterCount / 1000) * 0.18; // ~$0.18 per 1K characters

  } catch (error) {
    console.error("❌ Error converting text to speech:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  }
}

async function handleCallEnd(socket: WebSocket, data: any) {
  const callSid = data.stop?.callSid || data.streamSid;
  const session = activeCalls.get(callSid);

  if (!session) return;

  console.log(`📞 Call ended: ${callSid}`);

  // Close Deepgram connection
  if (session.deepgramSocket && session.deepgramSocket.readyState === WebSocket.OPEN) {
    session.deepgramSocket.close();
  }

  // Calculate call duration
  const endTime = new Date();
  const durationMs = endTime.getTime() - session.startTime.getTime();
  const durationMinutes = durationMs / 60000;

  // Calculate Deepgram cost (~$0.0043/min for Nova-2)
  session.costs.deepgram_stt = durationMinutes * 0.0043;

  // Calculate Twilio cost (estimated)
  session.costs.twilio = durationMinutes * 0.013;

  const totalCost = session.costs.deepgram_stt + session.costs.llm + session.costs.tts + session.costs.twilio;
  const chargedAmount = durationMinutes * 0.20; // What you charge client
  const profit = chargedAmount - totalCost;

  console.log(`💰 Call costs:`, {
    duration_minutes: durationMinutes.toFixed(2),
    deepgram_stt: session.costs.deepgram_stt.toFixed(4),
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

async function saveCallLog(session: any, durationMinutes: number, chargedAmount: number, totalCost: number, profit: number) {
  try {
    // Create call cost record
    const { data: callCost, error: costError } = await supabaseAdmin
      .from('call_costs')
      .insert({
        call_id: session.callSid,
        user_id: session.userId,
        campaign_id: session.campaignId,
        duration_seconds: Math.round(durationMinutes * 60),
        duration_minutes: durationMinutes,
        azure_stt_cost: session.costs.deepgram_stt,
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
          stt_provider: 'deepgram'
        }
      })
      .select()
      .single();

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
      await supabaseAdmin
        .from('call_costs')
        .update({ status: 'pending' })
        .eq('id', callCost.id);
    } else {
      console.log(`✅ Credits deducted: $${chargedAmount.toFixed(2)}`);
    }

  } catch (error) {
    console.error("❌ Error saving call log:", error);
  }
}
