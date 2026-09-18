import { getGatewayBaseUrl } from './edgeTtsService';

export interface GTTSVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  desc?: string;
}

export const DEFAULT_GTTS_VOICES: GTTSVoice[] = [
  { id: 'vi', name: 'Tiếng Việt', language: 'vi-VN', gender: 'female', desc: 'Giọng nữ Google Tiếng Việt tự nhiên' },
  { id: 'en', name: 'English (US)', language: 'en-US', gender: 'female', desc: 'Google English US Voice' },
  { id: 'zh-CN', name: 'Tiếng Trung (Phổ thông)', language: 'zh-CN', gender: 'female', desc: 'Google Chinese Mandarin Voice' },
  { id: 'ja', name: 'Tiếng Nhật', language: 'ja-JP', gender: 'female', desc: 'Google Japanese Voice' },
  { id: 'ko', name: 'Tiếng Hàn', language: 'ko-KR', gender: 'female', desc: 'Google Korean Voice' },
  { id: 'fr', name: 'Tiếng Pháp', language: 'fr-FR', gender: 'female', desc: 'Google French Voice' },
  { id: 'de', name: 'Tiếng Đức', language: 'de-DE', gender: 'female', desc: 'Google German Voice' },
  { id: 'es', name: 'Tiếng Tây Ban Nha', language: 'es-ES', gender: 'female', desc: 'Google Spanish Voice' },
  { id: 'ru', name: 'Tiếng Nga', language: 'ru-RU', gender: 'female', desc: 'Google Russian Voice' },
  { id: 'th', name: 'Tiếng Thái', language: 'th-TH', gender: 'female', desc: 'Google Thai Voice' },
];

export class GTTSService {
  public static async fetchVoices(baseUrl?: string): Promise<GTTSVoice[]> {
    try {
      const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
      const targetUrl = `${rootUrl}/api/gtts/voices`;
      const response = await fetch(targetUrl, {
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
      console.warn('[GTTSService] Failed to fetch gTTS voices, fallback to default list:', err);
    }
    return DEFAULT_GTTS_VOICES;
  }

  public static async synthesizeSpeech(
    text: string,
    lang: string = 'vi',
    speed: number = 1.0,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<Blob> {
    if (!text || !text.trim()) {
      throw new Error('Text to synthesize cannot be empty');
    }

    const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
    const targetUrl = `${rootUrl}/api/gtts/synthesize`;

    const isSlow = speed <= 0.7;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
        lang: lang || 'vi',
        slow: isSlow,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`gTTS synthesis failed (${response.status}): ${errText}`);
    }

    return await response.blob();
  }
}
