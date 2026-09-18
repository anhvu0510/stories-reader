export interface EdgeVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  desc?: string;
}

export const DEFAULT_EDGE_VOICES: EdgeVoice[] = [
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài Mỹ (Nữ - Tiếng Việt)', language: 'vi-VN', gender: 'female', desc: 'Giọng nữ tiếng Việt tự nhiên' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh (Nam - Tiếng Việt)', language: 'vi-VN', gender: 'male', desc: 'Giọng nam tiếng Việt truyền cảm' },
  { id: 'en-US-AvaNeural', name: 'Ava (Female - English US)', language: 'en-US', gender: 'female', desc: 'Giọng nữ tiếng Anh tự nhiên (US)' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (Male - English US)', language: 'en-US', gender: 'male', desc: 'Giọng nam tiếng Anh truyền cảm (US)' },
  { id: 'en-US-EmmaNeural', name: 'Emma (Female - English US)', language: 'en-US', gender: 'female', desc: 'Giọng nữ tiếng Anh chuẩn' },
  { id: 'en-US-BrianNeural', name: 'Brian (Male - English US)', language: 'en-US', gender: 'male', desc: 'Giọng nam tiếng Anh ấm áp' },
];

export class EdgeTTSService {
  public static async fetchVoices(baseUrl?: string): Promise<EdgeVoice[]> {
    try {
      const cleanUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
      const targetUrl = cleanUrl ? `${cleanUrl}/api/edge-tts/voices` : '/api/edge-tts/voices';
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
      console.warn('[EdgeTTSService] Failed to fetch Edge TTS voices, fallback to default list:', err);
    }
    return DEFAULT_EDGE_VOICES;
  }

  public static async synthesizeSpeech(
    text: string,
    voice: string = 'vi-VN-HoaiMyNeural',
    speed: number = 1.0,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<Blob> {
    if (!text || !text.trim()) {
      throw new Error('Text to synthesize cannot be empty');
    }

    const cleanUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
    const targetUrl = cleanUrl ? `${cleanUrl}/api/edge-tts/synthesize` : '/api/edge-tts/synthesize';

    // Convert speed factor (e.g. 1.2 => '+20%', 0.8 => '-20%')
    const ratePercentage = speed !== 1.0 ? `${speed >= 1.0 ? '+' : ''}${Math.round((speed - 1.0) * 100)}%` : '+0%';

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
        voice,
        rate: ratePercentage,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
    }

    return await response.blob();
  }
}
