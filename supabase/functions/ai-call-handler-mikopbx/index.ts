/**
 * AI Call Handler - MikoPBX AudioSocket Version
 *
 * Receives audio from MikoPBX via AudioSocket WebSocket protocol
 * Processes with Azure STT + OpenRouter + ElevenLabs
 * Sends audio back to customer via MikoPBX
 *
 * Protocol: AudioSocket (Asterisk 16.6+)
 * Transport: WebSocket
 * Audio Format: 8kHz µ-law
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// AudioSocket protocol implementation (inline to avoid deployment issues)
interface AudioSocketPacket {
  uuid: string;
  kind: number;
  payload: Uint8Array;
}

class AudioSocketProtocol {
  private callId: string = '';

  parsePacket(data: ArrayBuffer): AudioSocketPacket | null {
    const buffer = new Uint8Array(data);
    if (buffer.length < 19) return null;

    const uuidBytes = buffer.slice(0, 16);
    const uuid = new TextDecoder().decode(uuidBytes);
    if (!this.callId) this.callId = uuid.trim();

    const kind = buffer[16];
    const payloadLength = (buffer[17] << 8) | buffer[18];
    const payload = buffer.slice(19, 19 + payloadLength);

    return { uuid, kind, payload };
  }

  isAudioPacket(packet: AudioSocketPacket): boolean {
    return packet.kind === 0x01;
  }

  isHangupPacket(packet: AudioSocketPacket): boolean {
    return packet.kind === 0x10;
  }

  getCallId(): string {
    return this.callId;
  }
}

function mulawToPCM(mulaw: Uint8Array): Int16Array {
  const pcm = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    const sign = (mulaw[i] & 0x80) === 0 ? 1 : -1;
    const exponent = (mulaw[i] & 0x70) >> 4;
    const mantissa = mulaw[i] & 0x0F;
    let sample = ((mantissa << 3) + 33) << exponent;
    pcm[i] = sign * sample;
  }
  return pcm;
}

function pcmToMulaw(pcm: Int16Array): Uint8Array {
  const mulaw = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const sign = pcm[i] < 0 ? 0x80 : 0x00;
    let magnitude = Math.abs(pcm[i]);
    if (magnitude > 0x1FFF) magnitude = 0x1FFF;
    magnitude += 33;

    let exponent = 7;
    let expMask = 0x4000;
    while ((magnitude & expMask) === 0 && exponent > 0) {
      exponent--;
      expMask >>= 1;
    }

    const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
    mulaw[i] = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  }
  return mulaw;
}

function resampleAudio(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const fraction = srcIndex - srcIndexFloor;
    output[i] = Math.round(
      input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction
    );
  }
  return output;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master API Keys
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southeastasia';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // AudioSocket WebSocket endpoint
  const url = new URL(req.url);
  if (url.pathname === '/audio-socket') {
    return handleAudioSocketConnection(req);
  }

  return new Response('AI Call Handler - MikoPBX AudioSocket', {
    status: 200,
    headers: corsHeaders
  });
});

/**
 * Handle AudioSocket WebSocket connection from MikoPBX
 */
async function handleAudioSocketConnection(req: Request): Promise<Response> {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  // AudioSocket protocol handler
  const audioSocket = new AudioSocketProtocol();

  // AI session state
  let callId = '';
  let userId = '';
  let campaignId = '';
  let promptId = '';
  let phoneNumber = '';
  let customerName = '';

  // Audio buffers
  let audioBuffer: Int16Array = new Int16Array(0);
  let isProcessing = false;

  socket.onopen = () => {
    console.log("🔌 AudioSocket WebSocket connected from MikoPBX");
  };

  socket.onmessage = async (event) => {
    try {
      // Parse AudioSocket packet
      const packet = audioSocket.parsePacket(await event.data.arrayBuffer());

      if (!packet) {
        console.warn("⚠️  Invalid AudioSocket packet");
        return;
      }

      // Store call ID from first packet
      if (!callId) {
        callId = audioSocket.getCallId();
        console.log(`📞 New call: ${callId}`);

        // Fetch call metadata from database
        const callMetadata = await fetchCallMetadata(callId);
        if (callMetadata) {
          userId = callMetadata.user_id;
          campaignId = callMetadata.campaign_id;
          promptId = callMetadata.prompt_id;
          phoneNumber = callMetadata.phone_number;
          customerName = callMetadata.customer_name || '';
        }
      }

      // Handle hangup
      if (audioSocket.isHangupPacket(packet)) {
        console.log(`📞 Call ended: ${callId}`);
        await updateCallLog(callId, 'completed');
        socket.close();
        return;
      }

      // Handle audio data
      if (audioSocket.isAudioPacket(packet)) {
        // Convert µ-law to PCM
        const pcmChunk = mulawToPCM(packet.payload);

        // Append to buffer
        const newBuffer = new Int16Array(audioBuffer.length + pcmChunk.length);
        newBuffer.set(audioBuffer);
        newBuffer.set(pcmChunk, audioBuffer.length);
        audioBuffer = newBuffer;

        // Process when we have enough audio (e.g., 160ms = 1280 samples at 8kHz)
        if (audioBuffer.length >= 1280 && !isProcessing) {
          isProcessing = true;

          // Extract chunk to process
          const chunkToProcess = audioBuffer.slice(0, 1280);
          audioBuffer = audioBuffer.slice(1280);

          // Process audio with AI
          await processAudioChunk(
            socket,
            chunkToProcess,
            callId,
            userId,
            promptId,
            customerName
          );

          isProcessing = false;
        }
      }

    } catch (error) {
      console.error("❌ Error processing AudioSocket packet:", error);
    }
  };

  socket.onerror = (error) => {
    console.error("❌ AudioSocket WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log(`📞 AudioSocket connection closed: ${callId}`);
  };

  return response;
}

/**
 * Process audio chunk with AI pipeline
 */
async function processAudioChunk(
  socket: WebSocket,
  pcmAudio: Int16Array,
  callId: string,
  userId: string,
  promptId: string,
  customerName: string
): Promise<void> {
  try {
    // Resample from 8kHz to 16kHz for Azure STT
    const pcm16k = resampleAudio(pcmAudio, 8000, 16000);

    // Send to Azure STT
    const transcript = await sendToAzureSTT(pcm16k);

    if (transcript && transcript.trim().length > 0) {
      console.log(`👤 Customer: ${transcript}`);

      // Get AI response
      const aiResponse = await getAIResponse(transcript, userId, promptId, customerName);
      console.log(`🤖 AI: ${aiResponse}`);

      // Convert to speech
      const ttsAudio = await convertToSpeech(aiResponse);

      // Resample from 24kHz (ElevenLabs) to 8kHz (Asterisk)
      const ttsAudio8k = resampleAudio(ttsAudio, 24000, 8000);

      // Convert to µ-law
      const mulawAudio = pcmToMulaw(ttsAudio8k);

      // Send back to Asterisk via AudioSocket
      const packet = new Uint8Array(mulawAudio);
      socket.send(packet);

      // Log to database
      await logConversation(callId, transcript, aiResponse);
    }

  } catch (error) {
    console.error("❌ Error processing audio chunk:", error);
  }
}

/**
 * Fetch call metadata from database
 */
async function fetchCallMetadata(callId: string): Promise<any> {
  try {
    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error) {
      console.error("Error fetching call metadata:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in fetchCallMetadata:", error);
    return null;
  }
}

/**
 * Send audio to Azure STT
 */
async function sendToAzureSTT(pcm16k: Int16Array): Promise<string> {
  // TODO: Implement Azure STT integration
  // Use streaming recognition for real-time transcription
  // Return transcript
  return ""; // Placeholder
}

/**
 * Get AI response from OpenRouter
 */
async function getAIResponse(
  transcript: string,
  userId: string,
  promptId: string,
  customerName: string
): Promise<string> {
  // TODO: Implement OpenRouter GPT integration
  // Use streaming for low latency
  // Return AI response text
  return ""; // Placeholder
}

/**
 * Convert text to speech with ElevenLabs
 */
async function convertToSpeech(text: string): Promise<Int16Array> {
  // TODO: Implement ElevenLabs TTS integration
  // Return PCM audio at 24kHz
  return new Int16Array(0); // Placeholder
}

/**
 * Log conversation to database
 */
async function logConversation(
  callId: string,
  userMessage: string,
  aiMessage: string
): Promise<void> {
  try {
    // Update call_logs transcript
    const { error } = await supabaseAdmin
      .from('call_logs')
      .update({
        transcript: `User: ${userMessage}\nAI: ${aiMessage}\n`,
        updated_at: new Date().toISOString()
      })
      .eq('call_id', callId);

    if (error) {
      console.error("Error logging conversation:", error);
    }
  } catch (error) {
    console.error("Error in logConversation:", error);
  }
}

/**
 * Update call log status
 */
async function updateCallLog(callId: string, status: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('call_logs')
      .update({
        status,
        end_time: new Date().toISOString()
      })
      .eq('call_id', callId);

    if (error) {
      console.error("Error updating call log:", error);
    }
  } catch (error) {
    console.error("Error in updateCallLog:", error);
  }
}
