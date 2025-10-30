/**
 * AudioSocket Protocol Handler
 *
 * Handles Asterisk AudioSocket protocol format:
 * - Receives audio from Asterisk via WebSocket
 * - Sends audio back to Asterisk
 *
 * Protocol Format:
 * From Asterisk: [16-byte UUID] + [1-byte Kind] + [2-byte Length] + [Audio Data]
 * To Asterisk: [Audio Data only]
 */

export interface AudioSocketPacket {
  uuid: string;          // Call ID (16 bytes)
  kind: number;          // 0x00=Silence, 0x01=Audio, 0x10=Hangup
  payload: Uint8Array;   // Audio data
}

export class AudioSocketProtocol {
  private callId: string = '';

  /**
   * Parse incoming AudioSocket packet
   */
  parsePacket(data: ArrayBuffer): AudioSocketPacket | null {
    const buffer = new Uint8Array(data);

    if (buffer.length < 19) {
      // Minimum packet size: 16 (UUID) + 1 (Kind) + 2 (Length)
      return null;
    }

    // Extract UUID (16 bytes)
    const uuidBytes = buffer.slice(0, 16);
    const uuid = new TextDecoder().decode(uuidBytes);

    // Store call ID on first packet
    if (!this.callId) {
      this.callId = uuid.trim();
    }

    // Extract Kind (1 byte)
    const kind = buffer[16];

    // Extract Payload Length (2 bytes, big-endian)
    const payloadLength = (buffer[17] << 8) | buffer[18];

    // Extract Audio Data (remaining bytes)
    const payload = buffer.slice(19, 19 + payloadLength);

    return {
      uuid,
      kind,
      payload
    };
  }

  /**
   * Create AudioSocket packet to send to Asterisk
   * Note: Asterisk expects raw audio only (no header)
   */
  createPacket(audioData: Uint8Array): Uint8Array {
    // AudioSocket expects raw audio data for outgoing
    return audioData;
  }

  /**
   * Check if packet is audio data
   */
  isAudioPacket(packet: AudioSocketPacket): boolean {
    return packet.kind === 0x01;
  }

  /**
   * Check if packet is hangup signal
   */
  isHangupPacket(packet: AudioSocketPacket): boolean {
    return packet.kind === 0x10;
  }

  /**
   * Get stored call ID
   */
  getCallId(): string {
    return this.callId;
  }
}

/**
 * Convert µ-law to 16-bit PCM
 */
export function mulawToPCM(mulaw: Uint8Array): Int16Array {
  const pcm = new Int16Array(mulaw.length);

  for (let i = 0; i < mulaw.length; i++) {
    pcm[i] = mulawByteToShort(mulaw[i]);
  }

  return pcm;
}

function mulawByteToShort(mulawByte: number): number {
  const MULAW_BIAS = 33;
  const sign = (mulawByte & 0x80) === 0 ? 1 : -1;
  const exponent = (mulawByte & 0x70) >> 4;
  const mantissa = mulawByte & 0x0F;

  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample = sign * sample;

  return sample;
}

/**
 * Convert 16-bit PCM to µ-law
 */
export function pcmToMulaw(pcm: Int16Array): Uint8Array {
  const mulaw = new Uint8Array(pcm.length);

  for (let i = 0; i < pcm.length; i++) {
    mulaw[i] = shortToMulawByte(pcm[i]);
  }

  return mulaw;
}

function shortToMulawByte(pcmSample: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;

  const sign = pcmSample < 0 ? 0x80 : 0x00;
  let magnitude = Math.abs(pcmSample);

  if (magnitude > MULAW_MAX) {
    magnitude = MULAW_MAX;
  }

  magnitude += MULAW_BIAS;

  let exponent = 7;
  let expMask = 0x4000;

  while ((magnitude & expMask) === 0 && exponent > 0) {
    exponent--;
    expMask >>= 1;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
  const mulawByte = ~(sign | (exponent << 4) | mantissa);

  return mulawByte & 0xFF;
}

/**
 * Resample audio from one rate to another
 * Simple linear interpolation
 */
export function resampleAudio(
  input: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) {
    return input;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation
    output[i] = Math.round(
      input[srcIndexFloor] * (1 - fraction) +
      input[srcIndexCeil] * fraction
    );
  }

  return output;
}
