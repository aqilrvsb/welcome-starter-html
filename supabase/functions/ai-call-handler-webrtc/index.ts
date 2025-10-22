// AI Call Handler using MikoPBX WebRTC/WebSocket
// Connects to MikoPBX via SIP over WebSocket

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// SIP.js alternative - we'll use raw WebSocket + SIP protocol
class MikoPBXWebRTCClient {
  private ws: WebSocket | null = null;
  private callId: string = '';
  private sessionId: string = '';

  constructor(
    private mikopbxUrl: string,
    private extension: string,
    private password: string
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Connect to MikoPBX WebSocket
      this.ws = new WebSocket(this.mikopbxUrl);

      this.ws.onopen = () => {
        console.log('✅ Connected to MikoPBX WebSocket');
        this.register();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleSIPMessage(event.data);
      };
    });
  }

  private register(): void {
    // Send SIP REGISTER message
    const registerMsg = [
      `REGISTER sip:${this.extension}@68.183.177.218 SIP/2.0`,
      `Via: SIP/2.0/WSS df7jal23ls0d.invalid;branch=z9hG4bK${Math.random().toString(36).substr(2, 9)}`,
      `From: <sip:${this.extension}@68.183.177.218>;tag=${Math.random().toString(36).substr(2, 9)}`,
      `To: <sip:${this.extension}@68.183.177.218>`,
      `Call-ID: ${Math.random().toString(36).substr(2, 20)}@ai-handler`,
      `CSeq: 1 REGISTER`,
      `Contact: <sip:${this.extension}@df7jal23ls0d.invalid;transport=ws>`,
      `Expires: 600`,
      `Content-Length: 0`,
      ``,
      ``
    ].join('\r\n');

    console.log('📤 Sending REGISTER:', registerMsg);
    this.ws?.send(registerMsg);
  }

  private handleSIPMessage(data: string): void {
    console.log('📥 Received SIP message:', data);

    // Parse SIP response
    if (data.includes('SIP/2.0 200 OK')) {
      console.log('✅ Registration successful!');
    } else if (data.includes('SIP/2.0 401 Unauthorized')) {
      console.log('🔐 Need authentication, sending credentials...');
      // Handle authentication challenge
    } else if (data.includes('INVITE')) {
      console.log('📞 Incoming call!');
      this.handleIncomingCall(data);
    }
  }

  private handleIncomingCall(sipMessage: string): void {
    // Extract Call-ID, From, To from INVITE
    const callIdMatch = sipMessage.match(/Call-ID: (.+)/);
    const fromMatch = sipMessage.match(/From: (.+)/);

    if (callIdMatch) {
      this.callId = callIdMatch[1].trim();
      console.log('📞 Call ID:', this.callId);
    }

    // Send 200 OK to accept call
    const okResponse = [
      `SIP/2.0 200 OK`,
      `Via: ${sipMessage.match(/Via: (.+)/)?.[1]}`,
      `From: ${fromMatch?.[1]}`,
      `To: <sip:${this.extension}@68.183.177.218>;tag=${Math.random().toString(36).substr(2, 9)}`,
      `Call-ID: ${this.callId}`,
      `CSeq: ${sipMessage.match(/CSeq: (.+)/)?.[1]}`,
      `Contact: <sip:${this.extension}@df7jal23ls0d.invalid;transport=ws>`,
      `Content-Type: application/sdp`,
      `Content-Length: 0`,
      ``,
      ``
    ].join('\r\n');

    console.log('📤 Sending 200 OK');
    this.ws?.send(okResponse);
  }

  sendAudio(audioData: Uint8Array): void {
    // Send RTP audio over WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  disconnect(): void {
    this.ws?.close();
  }
}

// Main HTTP handler
serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === '/health') {
    return new Response('OK', { status: 200 });
  }

  // WebSocket upgrade for AI call handling
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = async () => {
      console.log('🌐 Client WebSocket opened');

      // Connect to MikoPBX
      const mikopbxClient = new MikoPBXWebRTCClient(
        'wss://68.183.177.218:8089/asterisk/ws',
        '999',
        'AIHandler2025@@'
      );

      try {
        await mikopbxClient.connect();
        console.log('✅ Connected to MikoPBX');

        socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected to MikoPBX'
        }));
      } catch (error) {
        console.error('❌ Failed to connect to MikoPBX:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to connect to MikoPBX'
        }));
      }
    };

    socket.onmessage = (event) => {
      console.log('📥 Received from client:', event.data);
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
    };

    return response;
  }

  return new Response('WebRTC AI Call Handler - Use WebSocket connection', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
});
