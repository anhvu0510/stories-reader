import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeTTSService, DEFAULT_EDGE_VOICES } from '../edgeTtsService';

describe('EdgeTTSService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default voices if fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );

    const voices = await EdgeTTSService.fetchVoices();
    expect(voices).toEqual(DEFAULT_EDGE_VOICES);
  });

  it('should fetch voices from gateway API when available', async () => {
    const mockVoices = [
      { id: 'vi-VN-HoaiMyNeural', name: 'Hoài Mỹ', language: 'vi-VN', gender: 'female' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ voices: mockVoices }),
      })
    );

    const voices = await EdgeTTSService.fetchVoices('https://api.test');
    expect(voices).toEqual(mockVoices);
  });

  it('should synthesize speech and return blob', async () => {
    const mockBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      })
    );

    const result = await EdgeTTSService.synthesizeSpeech('Xin chào', 'vi-VN-HoaiMyNeural', 1.2);
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns Microsoft word boundaries together with the audio blob', async () => {
    const boundaries = [
      {
        text: 'Xin',
        charIndex: 0,
        charLength: 3,
        startSeconds: 0.125,
        endSeconds: 0.325,
      },
      {
        text: 'chào',
        charIndex: 4,
        charLength: 4,
        startSeconds: 0.325,
        endSeconds: 0.5875,
      },
    ];
    const encodedBoundaries = Buffer.from(
      JSON.stringify([
        { text: 'Xin', char_index: 0, char_length: 3, start_seconds: 0.125, end_seconds: 0.325 },
        { text: 'chào', char_index: 4, char_length: 4, start_seconds: 0.325, end_seconds: 0.5875 },
      ]),
      'utf8'
    ).toString('base64url');
    const mockBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
      headers: new Headers({ 'X-Word-Boundaries': encodedBoundaries }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await EdgeTTSService.synthesizeSpeechWithBoundaries(
      'Xin chào',
      'vi-VN-HoaiMyNeural',
      1.2,
      'https://api.test'
    );

    expect(result.audio).toBe(mockBlob);
    expect(result.wordBoundaries).toEqual(boundaries);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      include_word_boundaries: true,
      rate: '+20%',
    });
  });
});
