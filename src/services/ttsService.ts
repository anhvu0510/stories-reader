export interface VieNeuVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  desc?: string;
}

export interface PcmAudioStream {
  body: ReadableStream<Uint8Array>;
  sampleRate: number;
  channels: number;
  sampleFormat: 's16le';
}

export const DEFAULT_VIENEU_SERVER_URL = 'https://api-anhvu0510.duckdns.org/vieneu-tts';

export const FALLBACK_VIENEU_VOICES: VieNeuVoice[] = [
  { id: 'Minh Quân', name: 'Minh Quân', language: 'vi', gender: 'male', desc: 'Giọng nam trầm ấm, tự nhiên (Default)' },
  { id: 'Mai Anh', name: 'Mai Anh', language: 'vi', gender: 'female', desc: 'Giọng nữ miền Bắc nhẹ nhàng, truyền cảm' },
  { id: 'Ái Hân', name: 'Ái Hân', language: 'vi', gender: 'female', desc: 'Giọng nữ mượt mà, đọc truyện/tiểu thuyết' },
  { id: 'Mỹ Duyên', name: 'Mỹ Duyên', language: 'vi', gender: 'female', desc: 'Giọng nữ trong trẻo, truyền cảm' },
  { id: 'Đức Trí', name: 'Đức Trí', language: 'vi', gender: 'male', desc: 'Giọng nam dõng dạc, tin tức/báo chí' },
  { id: 'Hữu Quân', name: 'Hữu Quân', language: 'vi', gender: 'male', desc: 'Giọng nam miền Nam tự nhiên' },
  { id: 'Xuân Tiên', name: 'Xuân Tiên', language: 'vi', gender: 'female', desc: 'Giọng nữ dịu dàng, trầm lắng' },
  { id: 'Trúc Ly', name: 'Trúc Ly', language: 'vi', gender: 'female', desc: 'Giọng nữ miền Nam truyền cảm' },
  { id: 'Anh Khôi', name: 'Anh Khôi', language: 'vi', gender: 'male', desc: 'Giọng nam trẻ trung, năng động' },
  { id: 'Mạnh Dũng', name: 'Mạnh Dũng', language: 'vi', gender: 'male', desc: 'Giọng nam miền Bắc truyền cảm' },
  { id: 'Adam', name: 'Adam', language: 'en', gender: 'male', desc: 'Giọng nam tiếng Anh chuẩn (English)' },
];

export class TTSService {
  public static async fetchVoices(baseUrl: string = DEFAULT_VIENEU_SERVER_URL): Promise<VieNeuVoice[]> {
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/v1/voices`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data?.voices) && data.voices.length > 0) {
        return data.voices;
      }
    } catch (err) {
      console.warn('[TTSService] Failed to fetch VieNeu voices, fallback to default list:', err);
    }
    return FALLBACK_VIENEU_VOICES;
  }

  public static async synthesizeSpeech(
    text: string,
    voice: string = 'Minh Quân',
    speed: number = 1.0,
    baseUrl: string = DEFAULT_VIENEU_SERVER_URL,
    signal?: AbortSignal
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
        model: 'vieneu-v3-turbo',
        input: text.trim(),
        voice: voice,
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
    voice: string = 'Minh Quân',
    speed: number = 1.0,
    baseUrl: string = DEFAULT_VIENEU_SERVER_URL,
    signal?: AbortSignal
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
        model: 'vieneu-v3-turbo',
        input: text.trim(),
        voice,
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
