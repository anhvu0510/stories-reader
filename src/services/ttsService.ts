export interface VieNeuVoice {
  id: string;
  name: string;
  language?: string;
  gender?: 'male' | 'female' | 'unknown';
  desc?: string;
}

export interface VieNeuModel {
  id: string;
  object?: string;
  owned_by?: string;
  active?: boolean;
  capabilities?: {
    streaming?: boolean;
    voice_metadata?: boolean;
    speed?: { min: number; max: number };
  };
}

export interface PcmAudioStream {
  body: ReadableStream<Uint8Array>;
  sampleRate: number;
  channels: number;
  sampleFormat: 's16le';
}

export const DEFAULT_VIENEU_SERVER_URL = 'https://api-anhvu0510.duckdns.org/vieneu-tts';

export class TTSService {
  public static async fetchModels(baseUrl: string = DEFAULT_VIENEU_SERVER_URL): Promise<VieNeuModel[]> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/v1/models`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.data)) throw new Error('VieNeu server returned an invalid model list');
    return data.data;
  }

  public static async fetchVoices(baseUrl: string = DEFAULT_VIENEU_SERVER_URL, model?: string): Promise<VieNeuVoice[]> {
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const query = model ? `?model=${encodeURIComponent(model)}` : '';
      const response = await fetch(`${cleanUrl}/v1/voices${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data?.voices)) {
        return data.voices;
      }
      throw new Error('VieNeu server returned an invalid voice list');
    } catch (err) {
      console.warn('[TTSService] Failed to fetch VieNeu voices:', err);
      throw err;
    }
  }

  public static async synthesizeSpeech(
    text: string,
    voice?: string,
    speed: number = 1.0,
    baseUrl: string = DEFAULT_VIENEU_SERVER_URL,
    signal?: AbortSignal,
    model?: string
  ): Promise<Blob> {
    if (!text || !text.trim()) {
      throw new Error('Input text cannot be empty');
    }

    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav, audio/mpeg, audio/pcm',
      },
      signal,
      body: JSON.stringify({
        model,
        input: text.trim(),
        ...(voice ? { voice } : {}),
        response_format: 'wav',
        speed: speed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TTS synthesis failed (${response.status}): ${errText}`);
    }

    return await response.blob();
  }

  public static async streamSpeech(
    text: string,
    voice?: string,
    speed: number = 1.0,
    baseUrl: string = DEFAULT_VIENEU_SERVER_URL,
    signal?: AbortSignal,
    model?: string
  ): Promise<PcmAudioStream> {
    if (!text || !text.trim()) {
      throw new Error('Input text cannot be empty');
    }

    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/v1/audio/speech/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/pcm',
      },
      signal,
      body: JSON.stringify({
        model,
        input: text.trim(),
        ...(voice ? { voice } : {}),
        response_format: 'pcm',
        speed,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TTS streaming failed (${response.status}): ${errText}`);
    }

    const sampleRate = Number(response.headers.get('X-Audio-Sample-Rate'));
    const channels = Number(response.headers.get('X-Audio-Channels'));
    const sampleFormat = response.headers.get('X-Audio-Sample-Format');
    if (!Number.isFinite(sampleRate) || sampleRate <= 0 || channels !== 1 || sampleFormat !== 's16le') {
      await response.body.cancel();
      throw new Error('TTS streaming returned unsupported PCM metadata');
    }

    return {
      body: response.body,
      sampleRate,
      channels,
      sampleFormat,
    };
  }

  public static createAudioUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  public static revokeAudioUrl(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
