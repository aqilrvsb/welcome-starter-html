export interface VapiAgent {
  id: string;
  name: string;
  voice: {
    provider: string;
    voiceId: string;
  };
  language?: string;
}

export interface VapiNumber {
  id: string;
  number: string;
  assistantId: string;
}

export interface VapiCallLog {
  id: string;
  assistantId: string;
  customer: {
    number: string;
  };
  startedAt: string;
  endedAt?: string;
  duration?: number;
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
}

export class VapiClient {
  private baseURL = 'https://api.vapi.ai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vapi API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Test API key validity
  async validateApiKey(): Promise<boolean> {
    try {
      await this.makeRequest('/assistants?limit=1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current user info
  async getMe() {
    return this.makeRequest('/me');
  }

  // Agent management
  async getAgents(): Promise<VapiAgent[]> {
    const response = await this.makeRequest('/assistants');
    return response.data || response;
  }

  async createAgent(agent: {
    name: string;
    voice: {
      provider: string;
      voiceId: string;
    };
    language?: string;
    firstMessage?: string;
  }): Promise<VapiAgent> {
    return this.makeRequest('/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name: agent.name,
        voice: agent.voice,
        language: agent.language || 'en',
        firstMessage: agent.firstMessage || `Hello! I'm ${agent.name}. How can I help you today?`,
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are ${agent.name}, a helpful AI assistant. Be concise and friendly.`
            }
          ]
        }
      }),
    });
  }

  // Number management
  async getNumbers(): Promise<VapiNumber[]> {
    const response = await this.makeRequest('/phone-numbers');
    return response.data || response;
  }

  async addNumber(number: {
    assistantId: string;
    phoneNumber?: string;
  }): Promise<VapiNumber> {
    return this.makeRequest('/phone-numbers', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: number.assistantId,
        number: number.phoneNumber,
      }),
    });
  }

  // Call logs
  async getCallLogs(limit: number = 50): Promise<VapiCallLog[]> {
    const response = await this.makeRequest(`/calls?limit=${limit}`);
    return response.data || response;
  }

  async getCall(callId: string): Promise<VapiCallLog> {
    return this.makeRequest(`/calls/${callId}`);
  }
}