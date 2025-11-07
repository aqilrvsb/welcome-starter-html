import { supabase } from '@/integrations/supabase/client';

// Default voice ID for Sarah from ElevenLabs
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

// Interface for voice configuration
export interface VoiceConfig {
  manual_voice_id?: string;
  country_code?: string;
  default_name?: string;
  concurrent_limit?: number;
  provider?: string;
  model?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
  optimize_streaming_latency?: number;
  auto_mode?: boolean;
}

// ElevenLabs voice parameters with all required settings
export const ELEVENLABS_VOICE_PARAMS = {
  provider: '11labs',
  model: 'eleven_flash_v2_5',
  stability: 0.8,
  similarityBoost: 1,
  style: 0.0,
  useSpeakerBoost: false,
  speed: 0.8,
  optimizeStreamingLatency: 4,
  autoMode: true,
  inputPunctuationBoundaries: [',', '،', '۔', '，', '.']
};

/**
 * Helper function to get the current voice ID
 * Checks manual_voice_id first, then falls back to default "sarah"
 */
export const getVoiceId = (manualVoiceId?: string | null): string => {
  return manualVoiceId && manualVoiceId.trim() !== '' 
    ? manualVoiceId.trim() 
    : DEFAULT_VOICE_ID;
};

/**
 * Get voice configuration for a specific user
 */
export const getUserVoiceConfig = async (userId: string): Promise<VoiceConfig | null> => {
  try {
    const { data, error } = await (supabase as any)
      .from('voice_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching voice config:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUserVoiceConfig:', error);
    return null;
  }
};

/**
 * Get the effective voice ID for a user (with fallback to default)
 */
export const getUserVoiceId = async (userId: string): Promise<string> => {
  const config = await getUserVoiceConfig(userId);
  return getVoiceId(config?.manual_voice_id);
};

/**
 * Get complete voice settings for ElevenLabs API
 */
export const getVoiceSettings = async (userId: string) => {
  const config = await getUserVoiceConfig(userId);
  const voiceId = getVoiceId(config?.manual_voice_id);
  
  return {
    voiceId,
    provider: config?.provider || ELEVENLABS_VOICE_PARAMS.provider,
    model: config?.model || ELEVENLABS_VOICE_PARAMS.model,
    stability: config?.stability ?? ELEVENLABS_VOICE_PARAMS.stability,
    similarityBoost: config?.similarity_boost ?? ELEVENLABS_VOICE_PARAMS.similarityBoost,
    style: config?.style ?? ELEVENLABS_VOICE_PARAMS.style,
    useSpeakerBoost: config?.use_speaker_boost ?? ELEVENLABS_VOICE_PARAMS.useSpeakerBoost,
    speed: config?.speed ?? ELEVENLABS_VOICE_PARAMS.speed,
    optimizeStreamingLatency: config?.optimize_streaming_latency ?? ELEVENLABS_VOICE_PARAMS.optimizeStreamingLatency,
    autoMode: config?.auto_mode ?? ELEVENLABS_VOICE_PARAMS.autoMode,
    inputPunctuationBoundaries: ELEVENLABS_VOICE_PARAMS.inputPunctuationBoundaries
  };
};

export { DEFAULT_VOICE_ID };