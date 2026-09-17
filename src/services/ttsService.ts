export interface VieNeuVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  desc?: string;
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
    baseUrl: string = DEFAULT_VIENEU_SERVER_URL
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

  public static createAudioUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  public static revokeAudioUrl(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
