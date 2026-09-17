// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitParagraphIntoSentences } from '../../services/gaplessTtsPlayer';
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
    vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());

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

    unmount();
  });
});
