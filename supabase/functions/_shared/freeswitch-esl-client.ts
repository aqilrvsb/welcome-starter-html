/**
 * FreeSWITCH ESL (Event Socket Layer) Client
 *
 * Simpler and better than Asterisk AMI!
 * Uses FreeSWITCH Event Socket to originate calls.
 */

export interface OriginateCallParams {
  phoneNumber: string;
  aiHandlerUrl: string;
  callerId?: string;
  variables?: Record<string, string>;
}

export interface OriginateCallResponse {
  success: boolean;
  callId?: string;
  error?: string;
}

export class FreeSwitchESLClient {
  private host: string;
  private port: number;
  private password: string;

  constructor(
    host = Deno.env.get('FREESWITCH_HOST') || 'localhost',
    port = parseInt(Deno.env.get('FREESWITCH_ESL_PORT') || '8021'),
    password = Deno.env.get('FREESWITCH_ESL_PASSWORD') || 'ClueCon'
  ) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  /**
   * Originate a call through AlienVOIP with audio streaming to AI handler
   */
  async originateCall(params: OriginateCallParams): Promise<OriginateCallResponse> {
    const { phoneNumber, aiHandlerUrl, callerId, variables = {} } = params;

    // Clean phone number (remove non-digits)
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    try {
      // Connect to FreeSWITCH ESL
      const conn = await Deno.connect({
        hostname: this.host,
        port: this.port,
      });

      console.log('✅ Connected to FreeSWITCH ESL');

      // Wait for initial greeting
      await this.readResponse(conn);

      // Authenticate
      await this.sendCommand(conn, `auth ${this.password}`);
      const authResponse = await this.readResponse(conn);

      if (!authResponse.includes('+OK')) {
        throw new Error('ESL authentication failed');
      }

      console.log('✅ ESL authenticated');

      // Build channel variables for mod_audio_fork
      const channelVars = {
        // Enable audio forking to WebSocket
        audio_fork_enable: 'true',
        audio_fork_url: aiHandlerUrl,
        audio_fork_sample_rate: '8000',
        audio_fork_channels: '1',

        // Call metadata
        ...variables,

        // Caller ID
        effective_caller_id_name: callerId || 'AI Call',
        effective_caller_id_number: cleanNumber,
      };

      // Format variables for originate command
      const varString = Object.entries(channelVars)
        .map(([key, value]) => `${key}='${value}'`)
        .join(',');

      // Originate command
      // Format: originate {variables}sofia/gateway/AlienVOIP/number &bridge(user/999)
      const originateCmd = `api originate {${varString}}sofia/gateway/AlienVOIP/${cleanNumber} &bridge(user/999)`;

      console.log('📞 Originating call:', originateCmd);

      await this.sendCommand(conn, originateCmd);
      const response = await this.readResponse(conn);

      // Close connection
      conn.close();

      // Parse response
      if (response.includes('+OK')) {
        // Extract UUID from response
        const uuidMatch = response.match(/\+OK (.+)/);
        const callId = uuidMatch ? uuidMatch[1].trim() : 'unknown';

        console.log('✅ Call originated successfully:', callId);

        return {
          success: true,
          callId: callId,
        };
      } else {
        console.error('❌ Call origination failed:', response);
        return {
          success: false,
          error: response,
        };
      }
    } catch (error) {
      console.error('❌ ESL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a command to ESL
   */
  private async sendCommand(conn: Deno.Conn, command: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\n\n');
    await conn.write(data);
  }

  /**
   * Read response from ESL
   */
  private async readResponse(conn: Deno.Conn): Promise<string> {
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
    }

    return response;
  }

  /**
   * Test ESL connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const conn = await Deno.connect({
        hostname: this.host,
        port: this.port,
      });

      await this.readResponse(conn);
      await this.sendCommand(conn, `auth ${this.password}`);
      const response = await this.readResponse(conn);

      conn.close();

      return response.includes('+OK');
    } catch (error) {
      console.error('❌ ESL connection test failed:', error);
      return false;
    }
  }
}

/**
 * Create ESL client with environment variables
 */
export function createFreeSwitchClient(): FreeSwitchESLClient {
  return new FreeSwitchESLClient();
}
