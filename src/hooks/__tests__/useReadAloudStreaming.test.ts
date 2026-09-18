// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitParagraphIntoSentences } from '../../services/gaplessTtsPlayer';
import { DomWordHighlighter } from '../../services/domWordHighlighter';
import { EdgeTTSService } from '../../services/edgeTtsService';
import { TTSService } from '../../services/ttsService';
import { useReaderConfigStore } from '../../stores/useReaderConfigStore';
import { useReadAloud } from '../useReadAloud';

const OriginalAudioContext = window.AudioContext;
const fakeAudioContexts: FakeAudioContext[] = [];

class FakeAudioContext {
  public currentTime = 0;
  public destination = {};
  public readonly sources: Array<{ playbackRate: { value: number }; onended: (() => void) | null }> = [];

  public constructor() {
    fakeAudioContexts.push(this);
  }

  public createBuffer(_channels: number, frameCount: number, sampleRate: number) {
    return {
      duration: frameCount / sampleRate,
      copyToChannel: vi.fn(),
    };
  }

  public createBufferSource() {
    const source = {
      buffer: null,
      playbackRate: { value: 1 },
      onended: null as (() => void) | null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.sources.push(source);
    return source;
  }

  public async decodeAudioData() {
    return { duration: 1 };
  }

  public async suspend() {}
  public async resume() {}
  public async close() {}
}

describe('splitParagraphIntoSentences', () => {
  it('splits a paragraph while preserving paragraph and text offsets', () => {
    const text =
      'Hai bóng người vô cùng cường đại. Thời đại này có mấy kẻ thấy chí bảo mà không hoảng sợ? Nữ nhân lên tiếng!';

    const sentences = splitParagraphIntoSentences(text, 4);

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toEqual({
      pIdx: 4,
      text: 'Hai bóng người vô cùng cường đại.',
      startOffset: 0,
      length: 'Hai bóng người vô cùng cường đại.'.length,
    });
    expect(sentences[1].startOffset).toBe(text.indexOf('Thời đại'));
    expect(sentences[2].text).toBe('Nữ nhân lên tiếng!');
  });

  it('merges a tiny trailing fragment into the preceding sentence', () => {
    const sentences = splitParagraphIntoSentences(
      'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!',
      1
    );

    expect(sentences).toEqual([
      {
        pIdx: 1,
        text: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!',
        startOffset: 0,
        length: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!'.length,
      },
    ]);
  });

  it('never merges sentences across paragraph boundaries', () => {
    const sentences = [
      ...splitParagraphIntoSentences('Chương một bắt đầu. Mọi thứ yên lặng.', 0),
      ...splitParagraphIntoSentences('Chương hai nối tiếp. Sấm sét đùng đùng!', 1),
    ];

    expect(sentences.map((sentence) => sentence.pIdx)).toEqual([0, 0, 1, 1]);
  });
});

describe('useReadAloud VieNeu streaming speed', () => {
  beforeEach(() => {
    fakeAudioContexts.length = 0;
    useReaderConfigStore.setState({
      speechRate: 2,
      ttsEngine: 'vieneu',
      voiceUri: 'Minh Quân',
      vieneuServerUrl: 'https://tts.example.test',
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: OriginalAudioContext,
    });
  });

  it('asks VieNeu to synthesize at the selected rate without speeding PCM up a second time', async () => {
    const streamSpeech = vi.spyOn(TTSService, 'streamSpeech').mockResolvedValue({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 0, 0, 0]));
          controller.close();
        },
      }),
      sampleRate: 24000,
      channels: 1,
      sampleFormat: 's16le',
    });
    const synthesizeSpeech = vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());

    const paragraphs = ['Câu đầu tiên. Câu thứ hai tiếp tục nội dung.'];
    const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

    act(() => result.current.startReading());

    await waitFor(() => expect(streamSpeech).toHaveBeenCalledTimes(1));
    expect(streamSpeech).toHaveBeenCalledWith(
      'Câu đầu tiên. Câu thứ hai tiếp tục nội dung.',
      'Minh Quân',
      2,
      'https://tts.example.test',
      expect.any(AbortSignal)
    );

    await waitFor(() =>
      expect(fakeAudioContexts[0].sources[0]?.playbackRate.value).toBe(1)
    );
    expect(synthesizeSpeech).not.toHaveBeenCalled();

    unmount();
  });

  it('keeps the visual highlight mounted until the next spoken word begins', async () => {
    const clearHighlight = vi.spyOn(DomWordHighlighter.prototype, 'clear');
    const streamSpeech = vi.spyOn(TTSService, 'streamSpeech').mockResolvedValue({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 0, 0, 0]));
          controller.close();
        },
      }),
      sampleRate: 24000,
      channels: 1,
      sampleFormat: 's16le',
    });
    vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());

    const paragraphs = ['Câu đầu tiên đủ dài để bắt đầu một lượt đọc.'];
    const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
    const clearsBeforePlayback = clearHighlight.mock.calls.length;

    act(() => result.current.startReading());
    await waitFor(() => expect(streamSpeech).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(clearHighlight).toHaveBeenCalledTimes(clearsBeforePlayback);

    unmount();
  });
});

describe('useReadAloud Edge word boundaries', () => {
  const OriginalAudio = window.Audio;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const fakeAudios: FakeEdgeAudio[] = [];

  class FakeEdgeAudio {
    public currentTime = 0;
    public paused = true;
    public ended = false;
    public onplay: (() => void) | null = null;
    public onpause: (() => void) | null = null;
    public ontimeupdate: (() => void) | null = null;
    public onended: (() => void) | null = null;
    public onerror: ((error: unknown) => void) | null = null;
    public readonly play = vi.fn(async () => {
      this.paused = false;
      this.onplay?.();
    });
    public readonly pause = vi.fn(() => {
      this.paused = true;
      this.onpause?.();
    });

    public constructor(public readonly src: string) {
      fakeAudios.push(this);
    }
  }

  beforeEach(() => {
    fakeAudios.length = 0;
    document.body.innerHTML = [
      '<main id="main-story-content"><article>',
      '<div data-paragraph-index="0">"Xin chào", thế giới.</div>',
      '</article></main>',
    ].join('');
    useReaderConfigStore.setState({
      speechRate: 1,
      ttsEngine: 'edge',
      edgeVoiceUri: 'vi-VN-HoaiMyNeural',
    });
    vi.stubGlobal('Audio', FakeEdgeAudio);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:edge-audio'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: OriginalAudio,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  it('moves the highlight from Microsoft word-boundary timestamps instead of estimating duration', async () => {
    const synthesize = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
      audio: new Blob(['audio'], { type: 'audio/mpeg' }),
      wordBoundaries: [
        { text: 'Xin', charIndex: 1, charLength: 3, startSeconds: 0.125, endSeconds: 0.325 },
        { text: 'chào', charIndex: 5, charLength: 4, startSeconds: 0.325, endSeconds: 0.5875 },
      ],
    });
    const highlight = vi.spyOn(DomWordHighlighter.prototype, 'highlight').mockReturnValue(null);
    const paragraphs = ['"Xin chào", thế giới.'];
    const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

    act(() => result.current.startReading());
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fakeAudios).toHaveLength(1));
    expect(highlight).not.toHaveBeenCalled();

    act(() => {
      fakeAudios[0].currentTime = 0.13;
      fakeAudios[0].ontimeupdate?.();
    });
    expect(highlight).toHaveBeenLastCalledWith(expect.any(HTMLElement), 1, 3);

    act(() => {
      fakeAudios[0].currentTime = 0.34;
      fakeAudios[0].ontimeupdate?.();
    });
    expect(highlight).toHaveBeenLastCalledWith(expect.any(HTMLElement), 5, 4);

    act(() => result.current.pauseReading());
    expect(fakeAudios[0].pause).toHaveBeenCalledTimes(1);
    act(() => result.current.startReading());
    expect(fakeAudios[0].play).toHaveBeenCalledTimes(2);

    unmount();
  });
});
