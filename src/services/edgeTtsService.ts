import { useAppStore } from '../stores/useAppStore';

export interface EdgeVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  desc?: string;
}

export interface EdgeWordBoundary {
  text: string;
  charIndex: number;
  charLength: number;
  startSeconds: number;
  endSeconds: number;
}

export interface EdgeSpeechWithBoundaries {
  audio: Blob;
  wordBoundaries: EdgeWordBoundary[];
}

export const DEFAULT_GATEWAY_URL = 'https://api-anhvu0510.duckdns.org';

export function getGatewayBaseUrl(): string {
  try {
    const activeDomain = useAppStore.getState().activeDomain;
    if (activeDomain && activeDomain.url) {
      return activeDomain.url.replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_GATEWAY_URL;
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
      const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
      const targetUrl = `${rootUrl}/tts/edge/voices`;
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

    const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
    const targetUrl = `${rootUrl}/tts/edge/synthesize`;

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

  public static async synthesizeSpeechWithBoundaries(
    text: string,
    voice: string = 'vi-VN-HoaiMyNeural',
    speed: number = 1.0,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<EdgeSpeechWithBoundaries> {
    if (!text || !text.trim()) {
      throw new Error('Text to synthesize cannot be empty');
    }

    const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
    const targetUrl = `${rootUrl}/tts/edge/synthesize`;
    const ratePercentage =
      speed !== 1.0
        ? `${speed >= 1.0 ? '+' : ''}${Math.round((speed - 1.0) * 100)}%`
        : '+0%';
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
        include_word_boundaries: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
    }

    const encodedBoundaries = response.headers.get('X-Word-Boundaries');
    if (!encodedBoundaries) {
      throw new Error('Edge TTS response did not include word boundaries');
    }

    const padded = encodedBoundaries
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedBoundaries.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const rawBoundaries = JSON.parse(new TextDecoder().decode(bytes)) as Array<{
      text: string;
      char_index: number;
      char_length: number;
      start_seconds: number;
      end_seconds: number;
    }>;
    const wordBoundaries = rawBoundaries.map((boundary) => ({
      text: boundary.text,
      charIndex: boundary.char_index,
      charLength: boundary.char_length,
      startSeconds: boundary.start_seconds,
      endSeconds: boundary.end_seconds,
    }));

    return {
      audio: await response.blob(),
      wordBoundaries,
    };
  }
}
