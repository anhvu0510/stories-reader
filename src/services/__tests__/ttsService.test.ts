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

describe('TTSService.fetchVoices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only the voice list received from the server', async () => {
    const voices = [{ id: 'Runtime Voice', name: 'Runtime Voice' }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ voices }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(TTSService.fetchVoices('https://tts.example.test/')).resolves.toEqual(voices);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://tts.example.test/v1/voices',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('does not silently replace an unavailable server list with hardcoded voices', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('offline', { status: 503 })));

    await expect(TTSService.fetchVoices('https://tts.example.test')).rejects.toThrow('HTTP error 503');
  });
});

describe('TTSService.fetchModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads model capabilities from the server', async () => {
    const models = [{ id: 'vieneu-v3-nano', active: true, capabilities: { speed: { min: 0.25, max: 4 } } }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: models }), { status: 200 })));

    await expect(TTSService.fetchModels('https://tts.example.test')).resolves.toEqual(models);
  });
});
