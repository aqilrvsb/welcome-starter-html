/**
 * Durable Object for Call Session Management
 * Handles stateful WebSocket connections for each call
 * Ensures zero data loss even with worker restarts
 */

import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

interface Env {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface CallState {
  callId: string;
  userId: string;
  status: 'active' | 'ended' | 'failed';
  startTime: number;
  audioBuffer: ArrayBuffer[];
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  metadata: Record<string, any>;
}

export class CallSessionDO {
  private state: DurableObjectState;
  private env: Env;
  private websocket: WebSocket | null = null;
  private callState: CallState | null = null;
  private openai: OpenAI | null = null;
  private supabase: any = null;
  private heartbeatInterval: number | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Initialize OpenAI with retry logic
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 30000,
    });

    // Initialize Supabase
    this.supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Restore state from durable storage
    this.state.blockConcurrencyWhile(async () => {
      const storedState = await this.state.storage.get<CallState>('callState');
      if (storedState) {
        this.callState = storedState;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle status check
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        callState: this.callState,
        connected: this.websocket !== null,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle WebSocket upgrade and connection
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const callId = url.searchParams.get('callId');
    const userId = url.searchParams.get('userId');

    if (!callId || !userId) {
      return new Response('Missing parameters', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();
    this.websocket = server;

    // Initialize call state
    this.callState = {
      callId,
      userId,
      status: 'active',
      startTime: Date.now(),
      audioBuffer: [],
      conversationHistory: [{
        role: 'system',
        content: 'You are a helpful AI assistant handling phone calls. Be concise and natural.'
      }],
      metadata: {}
    };

    // Save state to durable storage
    await this.state.storage.put('callState', this.callState);

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();

    // Start heartbeat
    this.startHeartbeat();

    // Log call start to Supabase
    await this.logCallEvent('call_started', { callId, userId });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Setup WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'audio':
            await this.handleAudioData(data);
            break;

          case 'text':
            await this.handleTextMessage(data);
            break;

          case 'start':
            await this.handleCallStart(data);
            break;

          case 'end':
            await this.handleCallEnd(data);
            break;

          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        this.sendError(error instanceof Error ? error.message : 'Unknown error');
      }
    });

    this.websocket.addEventListener('close', async () => {
      await this.handleConnectionClose();
    });

    this.websocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming audio data
   * Process through OpenAI for transcription and response
   */
  private async handleAudioData(data: any): Promise<void> {
    if (!this.callState) return;

    try {
      // Store audio chunk in buffer
      const audioData = new Uint8Array(data.audio);
      this.callState.audioBuffer.push(audioData.buffer);

      // Process audio through OpenAI Realtime API when buffer is sufficient
      if (this.callState.audioBuffer.length >= 10) { // ~1 second of audio
        const audioBlob = new Blob(this.callState.audioBuffer);

        // Transcribe using Whisper
        const transcription = await this.transcribeAudio(audioBlob);

        if (transcription) {
          // Add to conversation history
          this.callState.conversationHistory.push({
            role: 'user',
            content: transcription
          });

          // Generate AI response
          const response = await this.generateAIResponse();

          if (response) {
            // Convert text to speech
            const audioResponse = await this.textToSpeech(response);

            // Send audio back to FreeSWITCH
            this.sendWebSocketMessage({
              type: 'audio_response',
              audio: Array.from(new Uint8Array(audioResponse)),
              text: response
            });

            // Add to history
            this.callState.conversationHistory.push({
              role: 'assistant',
              content: response
            });
          }
        }

        // Clear buffer
        this.callState.audioBuffer = [];

        // Save state
        await this.state.storage.put('callState', this.callState);
      }
    } catch (error) {
      console.error('Audio processing error:', error);
      this.sendError('Failed to process audio');
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    if (!this.openai) return null;

    try {
      const file = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
      });

      return transcription.text;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  }

  /**
   * Generate AI response using GPT-4
   */
  private async generateAIResponse(): Promise<string | null> {
    if (!this.openai || !this.callState) return null;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: this.callState.conversationHistory as any,
        temperature: 0.7,
        max_tokens: 150, // Keep responses concise for calls
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('GPT response error:', error);
      return null;
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      speed: 1.0,
    });

    return await response.arrayBuffer();
  }

  /**
   * Handle text message
   */
  private async handleTextMessage(data: any): Promise<void> {
    console.log('Text message:', data.text);
  }

  /**
   * Handle call start
   */
  private async handleCallStart(data: any): Promise<void> {
    console.log('Call started:', data);
    await this.logCallEvent('call_in_progress', data);
  }

  /**
   * Handle call end
   */
  private async handleCallEnd(data: any): Promise<void> {
    if (!this.callState) return;

    this.callState.status = 'ended';
    await this.state.storage.put('callState', this.callState);

    // Log to Supabase
    await this.logCallEvent('call_ended', {
      ...data,
      duration: Date.now() - this.callState.startTime,
      conversationLength: this.callState.conversationHistory.length
    });

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close WebSocket
    this.websocket?.close();
  }

  /**
   * Handle connection close
   */
  private async handleConnectionClose(): Promise<void> {
    if (!this.callState) return;

    this.callState.status = 'ended';
    await this.state.storage.put('callState', this.callState);

    await this.logCallEvent('connection_closed', {
      duration: Date.now() - this.callState.startTime
    });

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Send message to WebSocket
   */
  private sendWebSocketMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(message: string): void {
    this.sendWebSocketMessage({
      type: 'error',
      message
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendWebSocketMessage({ type: 'ping' });
    }, 30000) as unknown as number; // Every 30 seconds
  }

  /**
   * Log event to Supabase
   */
  private async logCallEvent(event: string, data: any): Promise<void> {
    try {
      await this.supabase.from('call_logs').insert({
        call_id: this.callState?.callId,
        user_id: this.callState?.userId,
        event_type: event,
        event_data: data,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }
}
