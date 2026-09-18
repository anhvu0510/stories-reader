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
});
