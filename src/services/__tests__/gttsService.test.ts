import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GTTSService, DEFAULT_GTTS_VOICES } from '../gttsService';

describe('GTTSService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchVoices', () => {
    it('should return voices from server when request succeeds', async () => {
      const mockVoices = [
        { id: 'vi', name: 'Tiếng Việt', language: 'vi-VN', gender: 'female' },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ voices: mockVoices }),
        })
      );

      const res = await GTTSService.fetchVoices('https://api-test.com');
      expect(res).toEqual(mockVoices);
    });

    it('should fallback to DEFAULT_GTTS_VOICES when fetch fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      const res = await GTTSService.fetchVoices('https://api-test.com');
      expect(res).toEqual(DEFAULT_GTTS_VOICES);
    });
  });

  describe('synthesizeSpeech', () => {
    it('should throw error if input text is empty', async () => {
      await expect(GTTSService.synthesizeSpeech('   ')).rejects.toThrow(
        'Text to synthesize cannot be empty'
      );
    });

    it('should synthesize audio blob when request succeeds', async () => {
      const mockBlob = new Blob(['fake audio'], { type: 'audio/mpeg' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          blob: async () => mockBlob,
        })
      );

      const blob = await GTTSService.synthesizeSpeech('Xin chào', 'vi', 1.0, 'https://api-test.com');
      expect(blob).toBe(mockBlob);
    });
  });
});
