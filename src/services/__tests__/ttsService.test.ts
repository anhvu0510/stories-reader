import { afterEach, describe, expect, it, vi } from 'vitest';
import { TTSService } from '../ttsService';

describe('TTSService.synthesizeSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the playback session abort signal to the TTS request', async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn(async () =>
      new Response(new Blob(['audio']), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await TTSService.synthesizeSpeech(
      'Nội dung cần đọc.',
      'Minh Quân',
      1,
      'https://tts.example.test',
      signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://tts.example.test/v1/audio/speech',
      expect.objectContaining({ signal })
    );
  });
});
