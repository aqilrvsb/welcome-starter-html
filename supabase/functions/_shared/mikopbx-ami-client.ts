/**
 * MikoPBX AMI (Asterisk Manager Interface) Client
 *
 * Handles connection and communication with MikoPBX server
 * to originate outbound calls through AlienVOIP SIP trunk
 */

export interface MikoPBXConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface OriginateCallParams {
  phoneNumber: string;        // Destination phone number (e.g., +60123456789)
  aiExtension: string;         // AI handler extension (e.g., 999)
  callerId?: string;           // Caller ID to display
  context?: string;            // Asterisk context (default: all_peers)
  variables?: Record<string, string>; // Additional channel variables
}

export interface OriginateCallResponse {
  success: boolean;
  callId?: string;
  message?: string;
  error?: string;
}

export class MikoPBXAMIClient {
  private config: MikoPBXConfig;

  constructor(config: MikoPBXConfig) {
    this.config = config;
  }

  /**
   * Send AMI command via HTTP (AJAM - Asterisk Java AMI)
   * Using HTTP instead of raw TCP for better compatibility with Deno Deploy
   */
  private async sendAMICommand(action: string, params: Record<string, string> = {}): Promise<any> {
    try {
      // Build AMI command as URL parameters
      const urlParams = new URLSearchParams({
        Action: action,
        ...params
      });

      // Use AJAM (HTTP interface to AMI)
      // Note: Port 8088 is typically used for AJAM
      const ajamPort = 8088;
      const url = `http://${this.config.host}:${ajamPort}/rawman?${urlParams.toString()}`;

      console.log(`🔗 Sending AMI command to: ${this.config.host}:${ajamPort}`);
      console.log(`📤 Action: ${action}`, params);

      // First, login to get session cookie
      const loginUrl = `http://${this.config.host}:${ajamPort}/rawman?Action=Login&Username=${this.config.username}&Secret=${this.config.password}`;

      const loginResponse = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!loginResponse.ok) {
        throw new Error(`AMI login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      }

      // Extract session cookie
      const setCookie = loginResponse.headers.get('set-cookie');
      const loginText = await loginResponse.text();

      console.log('🔐 AMI Login response:', loginText);

      if (!loginText.includes('Response: Success')) {
        throw new Error('AMI authentication failed');
      }

      // Now send the actual command with the session cookie
      const commandResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(setCookie ? { 'Cookie': setCookie } : {}),
        },
      });

      if (!commandResponse.ok) {
        throw new Error(`AMI command failed: ${commandResponse.status} ${commandResponse.statusText}`);
      }

      const responseText = await commandResponse.text();
      console.log('📥 AMI Response:', responseText);

      return this.parseAMIResponse(responseText);

    } catch (error) {
      console.error('❌ AMI Command Error:', error);
      throw error;
    }
  }

  /**
   * Parse AMI text response into object
   */
  private parseAMIResponse(text: string): any {
    const lines = text.split('\n');
    const result: any = {};

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Originate an outbound call through MikoPBX → AlienVOIP → Customer
   *
   * Flow:
   * 1. MikoPBX calls the customer's phone via AlienVOIP SIP trunk
   * 2. When customer answers, connect them to AI handler extension
   * 3. AI handler (WebSocket) handles the conversation
   */
  async originateCall(params: OriginateCallParams): Promise<OriginateCallResponse> {
    try {
      console.log(`📞 Originating call to ${params.phoneNumber} via MikoPBX`);

      // Clean phone number (remove + sign for AlienVOIP)
      const cleanNumber = params.phoneNumber.replace(/^\+/, '');

      // Build channel string - calls customer through AlienVOIP trunk
      // SIP/AlienVOIP/{number} means: use AlienVOIP provider to call this number
      const channel = `SIP/AlienVOIP/${cleanNumber}`;

      // Context and extension - where to connect customer after they answer
      const context = params.context || 'all_peers';
      const extension = params.aiExtension || '999'; // AI handler extension

      // Caller ID
      const callerId = params.callerId || `AI Call <${cleanNumber}>`;

      // Channel variables (optional metadata)
      const variables: string[] = [];
      if (params.variables) {
        for (const [key, value] of Object.entries(params.variables)) {
          variables.push(`${key}=${value}`);
        }
      }

      // Send Originate command
      const amiParams: Record<string, string> = {
        Channel: channel,
        Context: context,
        Exten: extension,
        Priority: '1',
        CallerID: callerId,
        Async: 'true', // Return immediately, don't wait for call to complete
        Timeout: '30000', // 30 second timeout for call to be answered
      };

      if (variables.length > 0) {
        amiParams.Variable = variables.join(',');
      }

      const response = await this.sendAMICommand('Originate', amiParams);

      // Check response
      if (response.Response === 'Success') {
        console.log(`✅ Call originated successfully to ${params.phoneNumber}`);

        // Generate a call ID (AMI doesn't return one immediately for async calls)
        const callId = `mikopbx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
          success: true,
          callId: callId,
          message: response.Message || 'Call originated successfully',
        };
      } else {
        console.error(`❌ Call origination failed:`, response);
        return {
          success: false,
          error: response.Message || 'Unknown error',
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error originating call:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if AMI connection is working
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendAMICommand('Ping');
      return response.Response === 'Success';
    } catch (error) {
      console.error('❌ AMI Ping failed:', error);
      return false;
    }
  }

  /**
   * Get MikoPBX status
   */
  async getStatus(): Promise<any> {
    try {
      const response = await this.sendAMICommand('CoreStatus');
      return response;
    } catch (error) {
      console.error('❌ Failed to get MikoPBX status:', error);
      throw error;
    }
  }
}

/**
 * Create MikoPBX client with configuration from environment
 */
export function createMikoPBXClient(): MikoPBXAMIClient {
  const config: MikoPBXConfig = {
    host: Deno.env.get('MIKOPBX_HOST') || '68.183.177.218',
    port: parseInt(Deno.env.get('MIKOPBX_AMI_PORT') || '5038'),
    username: Deno.env.get('MIKOPBX_AMI_USERNAME') || 'batch-call-api',
    password: Deno.env.get('MIKOPBX_AMI_PASSWORD') || 'Dev2025@@',
  };

  return new MikoPBXAMIClient(config);
}
