/**
 * AI Call Handler - Azure STT WebSocket + OpenRouter LLM + ElevenLabs TTS
 * Version: 2.0 (Fixed session tracking)
 *
 * Architecture:
 * 1. Twilio calls this WebSocket endpoint
 * 2. Audio from caller → Azure Speech WebSocket (streaming) → Text
 * 3. Text → OpenRouter LLM → AI Response Text
 * 4. AI Response Text → ElevenLabs TTS → Audio
 * 5. Audio → Back to Twilio → Caller hears AI
 *
 * Using Azure Speech WebSocket for real-time streaming (like VAPI does)
 * More accurate than Deepgram for Malay language
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
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia'; // Restored for Malaysia
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? 'https://ahexnoaazbveiyhplfrc.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I'
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
    console.log("🔌 WebSocket connected - AI Call Handler ready (Azure STT Fixed)");
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
  try {
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

    console.log(`👤 User ID: ${userId}`);
    console.log(`📋 Campaign ID: ${campaignId}`);
    console.log(`📝 Prompt ID: ${promptId}`);

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

    // Azure STT WebSocket
    azureSttSocket: null,

    // Track costs
    costs: {
      azure_stt: 0,
      llm: 0,
      tts: 0,
      twilio: 0
    },

    // Azure STT auth/session info
    azureAuthToken: null,
    azureConnectionId: null
  };

  // Store session BEFORE initializing Azure to handle early media events
  activeCalls.set(callSid, session);
  console.log(`✅ Session registered: callSid=${callSid}, streamSid=${streamSid}`);
  console.log(`📊 Total active sessions: ${activeCalls.size}`);

  // Initialize Azure Speech WebSocket connection
  console.log(`🔄 Starting Azure STT initialization...`);
  await initializeAzureStt(session);
  console.log(`✅ Azure STT initialization completed`);

  console.log(`💬 System Prompt: ${systemPrompt.substring(0, 100)}...`);
  console.log(`🎤 First Message: ${firstMessage}`);

  // Send first message to caller
  console.log(`🎤 About to send first message to caller...`);
  await speakToCall(socket, session, firstMessage);
  console.log(`✅ handleCallStart completed successfully`);
}
catch (error) {
  console.error("❌ CRITICAL ERROR in handleCallStart:", error);
  if (error instanceof Error) {
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
  throw error;
}
}

async function initializeAzureStt(session: any) {
  try {
    // Validate Azure credentials before attempting connection
    if (!AZURE_SPEECH_KEY || AZURE_SPEECH_KEY.trim().length === 0) {
      console.error("❌ AZURE_SPEECH_KEY is not set in environment variables!");
      console.error("❌ Go to Supabase → Settings → Edge Functions → Add AZURE_SPEECH_KEY");
      return;
    }

    if (!AZURE_SPEECH_REGION || AZURE_SPEECH_REGION.trim().length === 0) {
      console.error("❌ AZURE_SPEECH_REGION is not set in environment variables!");
      return;
    }

    const keyLength = AZURE_SPEECH_KEY.trim().length;

    console.log(`🔌 Connecting to Azure Speech WebSocket (region: ${AZURE_SPEECH_REGION})...`);
    console.log(`✅ Subscription key detected: ${keyLength} characters`);
    console.log(`🔑 Key starts with: ${AZURE_SPEECH_KEY?.substring(0, 8)}...`);
    console.log(`🔑 Key ends with: ...${AZURE_SPEECH_KEY?.substring(Math.max(0, AZURE_SPEECH_KEY.length - 4))}`);

    // Generate connection ID
    const connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use subscription key directly in WebSocket URL (bypasses token service)
    // This avoids DNS issues with Azure token endpoint from Supabase
    console.log(`🌐 Using direct subscription key (bypassing token service for reliability)...`);
    const azureWsUrl = `wss://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ms-MY&format=detailed&Ocp-Apim-Subscription-Key=${encodeURIComponent(AZURE_SPEECH_KEY)}&X-ConnectionId=${connectionId}`;

    session.azureConnectionId = connectionId;

    console.log(`🔁 Using connectionId: ${connectionId}`);

    const azureSocket = new WebSocket(azureWsUrl);

    azureSocket.onopen = () => {
      console.log("✅ Azure Speech WebSocket connected successfully!");

      // Send configuration message
      const configMessage = {
        context: {
          system: {
            version: "1.0.0"
          },
          os: {
            platform: "WebSocket",
            name: "Deno",
            version: "1.0"
          },
          device: {
            manufacturer: "AI Call Pro",
            model: "Custom Pipeline",
            version: "1.0"
          }
        }
      };

      const timestamp = new Date().toISOString();
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Azure WebSocket protocol requires binary format for ALL messages:
      // [2 bytes: header length (little-endian)] + [header text] + [body]
      const configHeader = `Path: speech.config\r\nContent-Type: application/json; charset=utf-8\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\n\r\n`;
      const configBody = JSON.stringify(configMessage);
      
      const headerBytes = new TextEncoder().encode(configHeader);
      const bodyBytes = new TextEncoder().encode(configBody);
      const headerLength = headerBytes.length;

      console.log(`📏 Config header length: ${headerLength} bytes`);
      console.log(`📏 Config body length: ${bodyBytes.length} bytes`);
      console.log(`📏 Total payload size: ${2 + headerLength + bodyBytes.length} bytes`);

      // Create buffer: 2-byte header length + header + body
      const configPayload = new Uint8Array(2 + headerLength + bodyBytes.length);
      
      // Write header length as little-endian 16-bit integer
      configPayload[0] = headerLength & 0xFF;
      configPayload[1] = (headerLength >> 8) & 0xFF;
      
      console.log(`📏 Header length bytes: [${configPayload[0]}, ${configPayload[1]}]`);
      
      // Write header text
      configPayload.set(headerBytes, 2);
      
      // Write body
      configPayload.set(bodyBytes, 2 + headerLength);

      try {
        azureSocket.send(configPayload);
        console.log("✅ Sent Azure Speech configuration (binary format)");
        console.log(`📤 First 50 bytes: ${Array.from(configPayload.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      } catch (error) {
        console.error("❌ Failed to send Azure config:", error);
      }
    };

    azureSocket.onmessage = async (event) => {
      try {
        const message = event.data;

        // Azure Speech WebSocket sends messages in a specific format
        // Messages can be text (JSON) or binary
        if (typeof message === 'string') {
          // Parse the message format: Headers\r\n\r\nJSON body
          const parts = message.split('\r\n\r\n');
          if (parts.length >= 2) {
            const jsonBody = parts[parts.length - 1];
            const response = JSON.parse(jsonBody);

            console.log("🔍 Azure STT message:", JSON.stringify(response));

            // Azure sends different message types
            if (response.RecognitionStatus === 'Success' && response.DisplayText) {
              const transcript = response.DisplayText.trim();

              if (transcript && transcript.length > 2) {
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
            } else if (response.RecognitionStatus === 'NoMatch') {
              console.log("🔇 Azure: No speech detected");
            } else if (response.RecognitionStatus === 'InitialSilenceTimeout') {
              console.log("⏱️ Azure: Initial silence timeout");
            }
          }
        }
      } catch (error) {
        console.error("❌ Error parsing Azure STT response:", error);
      }
    };

    azureSocket.onerror = (error) => {
      console.error("❌ Azure Speech WebSocket error:", error);
      console.error("Error details:", JSON.stringify(error));
      console.error("WebSocket state:", azureSocket.readyState);
    };

    azureSocket.onclose = (event) => {
      console.log(`🔌 Azure Speech WebSocket closed - Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      console.log(`🔍 Close event details - wasClean: ${event.wasClean}, code: ${event.code}`);

      // Try to reconnect if closed unexpectedly during active call
      if (event.code !== 1000 && session && activeCalls.has(session.callSid)) {
        console.log("⚠️ Unexpected closure, attempting reconnect in 2 seconds...");
        setTimeout(() => {
          if (activeCalls.has(session.callSid)) {
            console.log("🔄 Attempting to reconnect Azure WebSocket...");
            initializeAzureStt(session);
          }
        }, 2000);
      }
    };

    session.azureSttSocket = azureSocket;

  } catch (error) {
    console.error("❌ Failed to initialize Azure Speech STT:", error);
  }
}

async function handleMediaStream(socket: WebSocket, data: any) {
  // Media events include streamSid, find the session by it
  const streamSid = data.streamSid;
  
  if (!streamSid) {
    console.warn("⚠️ No streamSid in media event");
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
    // Session not found - this happens when media arrives before 'start' event
    // This is normal and will resolve once the start event arrives
    return;
  }

  if (!session.azureSttSocket) {
    console.warn("⚠️ Azure STT socket not initialized yet, buffering audio...");
    return;
  }

  if (session.azureSttSocket.readyState !== WebSocket.OPEN) {
    console.warn(`⚠️ Azure STT WebSocket not ready. State: ${session.azureSttSocket.readyState}`);
    return;
  }

  // Process incoming audio from Twilio
  if (data.media && data.media.payload) {
    // Payload is base64-encoded µ-law audio from Twilio
    const audioPayload = data.media.payload;

    try {
      // Decode base64 to binary
      const binaryString = atob(audioPayload);
      const len = binaryString.length;
      const audioBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }

      // Azure Speech WebSocket protocol requires a specific binary format:
      // [2 bytes: header length (little-endian)] + [header text] + [audio data]
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const audioHeader = `Path: audio\r\nContent-Type: audio/x-mulaw; codec=mulaw; samplerate=8000\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\n\r\n`;

      const headerBytes = new TextEncoder().encode(audioHeader);
      const headerLength = headerBytes.length;

      // Create buffer: 2-byte header length + header + audio
      const combined = new Uint8Array(2 + headerLength + audioBytes.length);
      
      // Write header length as little-endian 16-bit integer
      combined[0] = headerLength & 0xFF;
      combined[1] = (headerLength >> 8) & 0xFF;
      
      // Write header text
      combined.set(headerBytes, 2);
      
      // Write audio data
      combined.set(audioBytes, 2 + headerLength);

      // Send to Azure WebSocket
      session.azureSttSocket.send(combined);
    } catch (error) {
      console.error("❌ Error sending audio to Azure STT:", error);
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
    console.log("🔊 Converting text to speech...");
    console.log(`📝 Text to speak: ${text}`);

    // Determine which TTS provider to use
    // If ELEVENLABS_API_KEY is set, use ElevenLabs (higher quality)
    // Otherwise, use Azure TTS (cheaper, included with Azure Speech)
    const useElevenLabs = ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.trim().length > 0;

    let audioArray: Uint8Array;

    if (useElevenLabs) {
      // Use ElevenLabs Turbo v2.5 for higher quality
      const voiceId = session.voiceId || "UcqZLa941Kkt8ZhEEybf";
      const speed = session.voiceSpeed || 0.8;

      console.log(`🎤 Using ElevenLabs voice: ${voiceId}, speed: ${speed}`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/basic',
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
            use_speaker_boost: true
          },
          output_format: 'ulaw_8000'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      audioArray = new Uint8Array(audioBuffer);

      // Track ElevenLabs TTS cost
      const characterCount = text.length;
      session.costs.tts += (characterCount / 1000) * 0.18; // ~$0.18 per 1K characters

      console.log(`📦 Received ${audioArray.length} bytes of audio from ElevenLabs`);

    } else {
      // Use Azure Neural TTS (cheaper alternative)
      // Map ElevenLabs voice IDs to Azure voice names
      const voiceMapping: { [key: string]: string } = {
        'UcqZLa941Kkt8ZhEEybf': 'ms-MY-YasminNeural', // Afifah → Yasmin (Malay female)
        'default': 'ms-MY-YasminNeural'
      };

      const azureVoice = voiceMapping[session.voiceId] || voiceMapping['default'];
      const speed = session.voiceSpeed || 0.8;
      const speedPercent = Math.round((speed - 1) * 100); // Convert 0.8 to -20%

      console.log(`🎤 Using Azure TTS voice: ${azureVoice}, speed: ${speedPercent}%`);

      // Azure TTS SSML format
      const ssml = `
        <speak version='1.0' xml:lang='ms-MY'>
          <voice xml:lang='ms-MY' name='${azureVoice}'>
            <prosody rate='${speedPercent}%'>
              ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </prosody>
          </voice>
        </speak>
      `.trim();

      const response = await fetch(
        `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || '',
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'raw-8khz-8bit-mono-mulaw', // µ-law 8kHz for Twilio
            'User-Agent': 'AI-Call-Pro'
          },
          body: ssml
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure TTS API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      audioArray = new Uint8Array(audioBuffer);

      // Track Azure TTS cost (much cheaper!)
      const characterCount = text.length;
      session.costs.tts += (characterCount / 1000000) * 16; // $16 per 1M characters = $0.024/min avg

      console.log(`📦 Received ${audioArray.length} bytes of audio from Azure TTS`);
    }

    // Common code for sending audio to Twilio (works for both providers)

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
    const CHUNK_SIZE = 160; // 160 bytes = 20ms at 8kHz µ-law (Twilio recommended)
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

      // Small delay every 50 chunks to prevent flooding
      if (chunksSent % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
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

  // Close Azure STT WebSocket connection
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
