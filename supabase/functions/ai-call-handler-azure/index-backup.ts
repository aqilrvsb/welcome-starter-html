/**
 * AI Call Handler - Azure STT + OpenRouter LLM + ElevenLabs TTS
 *
 * Architecture:
 * 1. Twilio calls this WebSocket endpoint
 * 2. Audio from caller → Azure Speech STT → Text
 * 3. Text → OpenRouter LLM → AI Response Text
 * 4. AI Response Text → ElevenLabs TTS → Audio
 * 5. Audio → Back to Twilio → Caller hears AI
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
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';
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
    console.log("🔌 WebSocket connected - AI Call Handler ready (Azure STT)");
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 Received message:", data.event);

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
    startTime: new Date(),
    transcript: [],
    conversationHistory: [
      { role: 'system', content: systemPrompt }
    ],
    audioBuffer: [],

    // Connect to Azure Speech STT WebSocket
    azureSttSocket: null,

    // Track costs
    costs: {
      azure_stt: 0,
      llm: 0,
      tts: 0,
      twilio: 0
    }
  };

  // Initialize Azure Speech STT WebSocket connection
  await initializeAzureSpeech(session);

  activeCalls.set(callSid, session);

  // Send first message to caller
  await speakToCall(socket, session, firstMessage);
}

async function initializeAzureSpeech(session: any) {
  try {
    // Azure Speech SDK WebSocket endpoint
    const azureWsUrl = `wss://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY&format=detailed`;

    const azureSocket = new WebSocket(azureWsUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || ''
      }
    });

    azureSocket.onopen = () => {
      console.log("✅ Azure Speech STT connected");
    };

    azureSocket.onmessage = async (event) => {
      const response = JSON.parse(event.data);

      // Azure returns results in RecognitionStatus
      if (response.RecognitionStatus === 'Success' && response.DisplayText) {
        const transcript = response.DisplayText;

        if (transcript && transcript.trim()) {
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
          await getAIResponse(session, transcript);
        }
      }
    };

    azureSocket.onerror = (error) => {
      console.error("❌ Azure Speech error:", error);
    };

    session.azureSttSocket = azureSocket;

  } catch (error) {
    console.error("❌ Failed to initialize Azure Speech:", error);
  }
}

async function handleMediaStream(socket: WebSocket, data: any) {
  const callSid = data.start?.callSid || data.streamSid;
  const session = activeCalls.get(callSid);

  if (!session || !session.azureSttSocket) return;

  // Forward audio to Azure Speech for transcription
  if (data.media && data.media.payload) {
    // Payload is base64-encoded µ-law audio
    const audioPayload = data.media.payload;

    // Send to Azure Speech
    if (session.azureSttSocket.readyState === WebSocket.OPEN) {
      // Azure Speech expects specific format
      const audioMessage = {
        audio: {
          type: 'audio/x-ms-speech',
          format: 'mulaw',
          data: audioPayload
        }
      };

      session.azureSttSocket.send(JSON.stringify(audioMessage));
    }
  }
}

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
      throw new Error(`OpenRouter API error: ${response.status}`);
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
        output_format: 'ulaw_8000' // Match Twilio format
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
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

    if (twilioSocket && twilioSocket.readyState === WebSocket.OPEN) {
      // Send audio to Twilio in chunks
      // Twilio Media Stream expects base64-encoded µ-law audio
      const CHUNK_SIZE = 640; // Larger chunks for better streaming (80ms)

      for (let i = 0; i < audioArray.length; i += CHUNK_SIZE) {
        const chunk = audioArray.slice(i, Math.min(i + CHUNK_SIZE, audioArray.length));

        // Convert chunk to base64
        let binary = '';
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
        const chunkBase64 = btoa(binary);

        // Send to Twilio Media Stream
        twilioSocket.send(JSON.stringify({
          event: 'media',
          streamSid: session.streamSid,
          media: {
            payload: chunkBase64
          }
        }));
      }

      // Send mark event to indicate audio is complete
      twilioSocket.send(JSON.stringify({
        event: 'mark',
        streamSid: session.streamSid,
        mark: {
          name: `audio_complete_${Date.now()}`
        }
      }));

      console.log(`✅ Sent ${Math.ceil(audioArray.length / CHUNK_SIZE)} audio chunks (${audioArray.length} bytes total)`);
    } else {
      console.warn("⚠️ WebSocket not available, cannot send audio");
    }

    // Track TTS cost (estimate based on characters)
    const characterCount = text.length;
    session.costs.tts += (characterCount / 1000) * 0.18; // ~$0.18 per 1K characters

  } catch (error) {
    console.error("❌ Error converting text to speech:", error);
  }
}

async function handleCallEnd(socket: WebSocket, data: any) {
  const callSid = data.stop?.callSid || data.streamSid;
  const session = activeCalls.get(callSid);

  if (!session) return;

  console.log(`📞 Call ended: ${callSid}`);

  // Close Azure Speech connection
  if (session.azureSttSocket) {
    session.azureSttSocket.close();
  }

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
