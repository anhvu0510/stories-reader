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

  it('opens the PCM endpoint as a readable audio stream', async () => {
    const signal = new AbortController().signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () =>
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/pcm',
          'X-Audio-Sample-Rate': '24000',
          'X-Audio-Channels': '1',
          'X-Audio-Sample-Format': 's16le',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const stream = await TTSService.streamSpeech(
      'Nội dung phát trực tuyến.',
      'Mai Anh',
      1.25,
      'https://tts.example.test/',
      signal
    );
    const reader = stream.body.getReader();
    const firstChunk = await reader.read();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://tts.example.test/v1/audio/speech/stream',
      expect.objectContaining({ signal })
    );
    expect(stream.sampleRate).toBe(24000);
    expect(stream.channels).toBe(1);
    expect(firstChunk.value).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
