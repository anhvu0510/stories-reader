import { describe, expect, it, vi } from 'vitest';
import {
  buildSpeechSegments,
  buildWordTimeline,
  GaplessTtsPlayer,
  splitParagraphIntoSentences,
  WebAudioPlaybackEngine,
  type AudioPlaybackEngine,
  type DecodedAudio,
  type PcmStreamPlayback,
  type ScheduledAudio,
  type SpeechSegment,
} from '../gaplessTtsPlayer';

function createPendingPromise(): Promise<void> {
  return new Promise(() => {});
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise = () => {};
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function createSegment(index: number): SpeechSegment {
  const text = `Segment ${index}.`;
  return {
    pIdx: 0,
    text,
    startOffset: index * (text.length + 1),
    length: text.length,
    sentenceStartIndex: index,
    sentenceEndIndex: index,
  };
}

describe('buildSpeechSegments', () => {
  it('groups consecutive sentences without losing their text or paragraph position', () => {
    const firstText = 'Câu thứ nhất đủ ý.';
    const secondText = 'Câu thứ hai nối tiếp.';
    const thirdText = 'Câu thứ ba kết thúc.';
    const firstOffset = 10;
    const secondOffset = firstOffset + firstText.length + 1;
    const thirdOffset = secondOffset + secondText.length + 1;

    const segments = buildSpeechSegments(
      [
        { pIdx: 2, text: firstText, startOffset: firstOffset, length: firstText.length },
        { pIdx: 2, text: secondText, startOffset: secondOffset, length: secondText.length },
        { pIdx: 2, text: thirdText, startOffset: thirdOffset, length: thirdText.length },
      ],
      { targetCharacters: 35, maxCharacters: 70 }
    );

    expect(segments).toEqual([
      {
        pIdx: 2,
        text: 'Câu thứ nhất đủ ý. Câu thứ hai nối tiếp.',
        startOffset: firstOffset,
        length: firstText.length + secondText.length + 1,
        sentenceStartIndex: 0,
        sentenceEndIndex: 1,
      },
      {
        pIdx: 2,
        text: 'Câu thứ ba kết thúc.',
        startOffset: thirdOffset,
        length: thirdText.length,
        sentenceStartIndex: 2,
        sentenceEndIndex: 2,
      },
    ]);
  });

  it('keeps default streaming requests within one natural phrase', () => {
    const paragraph = [
      'Câu thứ nhất giới thiệu bối cảnh và các nhân vật đang xuất hiện trong câu chuyện.',
      'Câu thứ hai tiếp tục diễn biến để luồng đọc có đủ dữ liệu dự phòng.',
      'Câu thứ ba khép lại đoạn văn nhưng vẫn thuộc cùng một yêu cầu phát âm.',
    ].join(' ');
    const sentences = splitParagraphIntoSentences(paragraph, 3);

    const segments = buildSpeechSegments(sentences);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => segment.length <= 180)).toBe(true);
    expect(segments.map((segment) => segment.text).join(' ')).toBe(paragraph);
  });

  it('splits an unusually long sentence into source-aligned speech phrases', () => {
    const paragraph = [
      'Đây là một mệnh đề khá dài để kiểm tra cách chia cụm đọc tự nhiên',
      'tiếp theo là một mệnh đề khác vẫn giữ nguyên dấu câu và vị trí ký tự',
      'cuối cùng là phần kết thúc để tổng chiều dài vượt quá giới hạn thông thường.',
    ].join(', ');

    const phrases = splitParagraphIntoSentences(paragraph, 0);

    expect(phrases.length).toBeGreaterThan(1);
    expect(phrases.every((phrase) => phrase.length <= 180)).toBe(true);
    phrases.forEach((phrase) => {
      expect(paragraph.slice(phrase.startOffset, phrase.startOffset + phrase.length)).toBe(
        phrase.text
      );
    });

    const segments = buildSpeechSegments(phrases);
    expect(segments.every((segment) => segment.length <= 480)).toBe(true);
  });

  it('keeps VieNeu phrases within one backend inference without dropping source text', () => {
    const paragraph = [
      'Ngày hôm sau, Tần Thành lại tới, sau khi gửi thiệp cưới và bình tâm lại,',
      'nhìn thấy mấy chục sợi tóc bạc bên thái dương Vương Huyên, hắn không khỏi lo lắng.',
      'Cơ thể ngươi sẽ không để lại di chứng gì chứ.',
    ].join(' ');

    const phrases = splitParagraphIntoSentences(paragraph, 0, {
      maxCharacters: 120,
    });
    const segments = buildSpeechSegments(phrases, {
      targetCharacters: 108,
      maxCharacters: 120,
    });

    expect(phrases.every((phrase) => phrase.length <= 120)).toBe(true);
    expect(segments.every((segment) => segment.length <= 120)).toBe(true);

    let sourceCursor = 0;
    phrases.forEach((phrase) => {
      expect(paragraph.slice(sourceCursor, phrase.startOffset).trim()).toBe('');
      expect(paragraph.slice(phrase.startOffset, phrase.startOffset + phrase.length)).toBe(
        phrase.text
      );
      sourceCursor = phrase.startOffset + phrase.length;
    });
    expect(paragraph.slice(sourceCursor).trim()).toBe('');
  });

  it('does not merge a short trailing sentence past the phrase limit', () => {
    const longSentence = `${'một '.repeat(44).trim()}.`;
    const paragraph = `${longSentence} Ừm nhé.`;

    const phrases = splitParagraphIntoSentences(paragraph, 0);

    expect(phrases.every((phrase) => phrase.length <= 180)).toBe(true);
  });

  it('preserves source offsets when a sentence starts with a closing quote', () => {
    const paragraph = '"Chút vấn đề nhỏ thôi." Vương Huyên hiện tại ổn.';
    const sentences = splitParagraphIntoSentences(paragraph, 0);

    const [segment] = buildSpeechSegments(sentences, {
      targetCharacters: 200,
      maxCharacters: 300,
    });

    expect(segment.text).toBe(paragraph);
    expect(segment.length).toBe(paragraph.length);
    expect(segment.text.indexOf('Vương')).toBe(paragraph.indexOf('Vương'));
  });
});

describe('buildWordTimeline', () => {
  it('maps every spoken word to an increasing audio-clock offset', () => {
    const timeline = buildWordTimeline('Xin chào, bạn nhé.', 4);

    expect(timeline.map((cue) => cue.text)).toEqual(['Xin', 'chào', 'bạn', 'nhé']);
    expect(timeline.map((cue) => cue.charIndex)).toEqual([0, 4, 10, 14]);
    expect(timeline.every((cue, index) => index === 0 || cue.startSeconds > timeline[index - 1].startSeconds)).toBe(true);
    expect(timeline.at(-1)?.startSeconds).toBeLessThan(4);
    expect(timeline[2].startSeconds - timeline[1].startSeconds).toBeGreaterThan(
      timeline[1].startSeconds - timeline[0].startSeconds
    );
  });
});

describe('GaplessTtsPlayer', () => {
  it.each([
    {
      previousText: 'Một nhịp đọc mềm',
      nextParagraphIndex: 0,
      expectedStart: 2.04,
      boundary: 'soft split',
    },
    { previousText: 'Một mệnh đề,', nextParagraphIndex: 0, expectedStart: 2.12, boundary: 'clause' },
    {
      previousText: 'Một câu hoàn chỉnh.',
      nextParagraphIndex: 0,
      expectedStart: 2.26,
      boundary: 'sentence',
    },
    {
      previousText: 'Một câu hỏi?',
      nextParagraphIndex: 0,
      expectedStart: 2.34,
      boundary: 'expressive sentence',
    },
    {
      previousText: 'Một ý còn bỏ ngỏ…',
      nextParagraphIndex: 0,
      expectedStart: 2.46,
      boundary: 'ellipsis',
    },
    {
      previousText: 'Kết thúc đoạn.',
      nextParagraphIndex: 1,
      expectedStart: 2.56,
      boundary: 'paragraph',
    },
  ])('adds a natural-fast pause at a $boundary boundary', async ({
    previousText,
    nextParagraphIndex,
    expectedStart,
  }) => {
    const scheduledStarts: number[] = [];
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn((audio: DecodedAudio, startAt: number): ScheduledAudio => {
        scheduledStarts.push(startAt);
        return {
          endAt: startAt + audio.duration,
          ended: createPendingPromise(),
          stop: vi.fn(),
        };
      }),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const synthesize = vi.fn(async () => new Blob(['audio']));
    const segments: SpeechSegment[] = [
      {
        pIdx: 0,
        text: previousText,
        startOffset: 0,
        length: previousText.length,
        sentenceStartIndex: 0,
        sentenceEndIndex: 0,
      },
      {
        pIdx: nextParagraphIndex,
        text: 'Segment hai.',
        startOffset: 13,
        length: 12,
        sentenceStartIndex: 1,
        sentenceEndIndex: 1,
      },
    ];
    const player = new GaplessTtsPlayer({ engine, synthesize, startLeadSeconds: 0 });

    player.start(segments);
    await vi.waitFor(() => expect(scheduledStarts).toHaveLength(2));

    expect(scheduledStarts).toEqual([0, expectedStart]);
    expect(synthesize).toHaveBeenCalledTimes(2);

    await player.stop();
  });

  it('prefetches two segments ahead without requesting the whole story', async () => {
    const firstEnded = createDeferred();
    const secondEnded = createDeferred();
    const endedQueue = [
      firstEnded.promise,
      secondEnded.promise,
      createPendingPromise(),
      createPendingPromise(),
    ];
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn((audio: DecodedAudio, startAt: number): ScheduledAudio => ({
        endAt: startAt + audio.duration,
        ended: endedQueue.shift() ?? createPendingPromise(),
        stop: vi.fn(),
      })),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const synthesize = vi.fn(async () => new Blob(['audio']));
    const player = new GaplessTtsPlayer({ engine, synthesize, startLeadSeconds: 0 });

    player.start([createSegment(0), createSegment(1), createSegment(2), createSegment(3)]);
    await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3));
    expect(synthesize).toHaveBeenCalledTimes(3);
    expect(engine.schedule).toHaveBeenCalledTimes(2);

    firstEnded.resolve();
    await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(4));

    secondEnded.resolve();
    await player.stop();
  });

  it('aborts an in-flight synthesis request when playback stops', async () => {
    let requestSignal: AbortSignal | undefined;
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn(),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const synthesize = vi.fn((_segment: SpeechSegment, signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<Blob>(() => {});
    });
    const player = new GaplessTtsPlayer({ engine, synthesize });

    player.start([createSegment(0)]);
    await vi.waitFor(() => expect(requestSignal).toBeDefined());
    await player.stop();

    expect(requestSignal?.aborted).toBe(true);
    expect(engine.schedule).not.toHaveBeenCalled();
  });

  it('streams PCM with a paragraph pause without using WAV fallback', async () => {
    const streamStarts: number[] = [];
    const appendedChunks: number[][] = [];
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn(),
      beginPcmStream: vi.fn((sampleRate, _channels, startAt): PcmStreamPlayback => {
        let duration = 0;
        streamStarts.push(startAt);
        return {
          startAt,
          get duration() {
            return duration;
          },
          get endAt() {
            return startAt + duration;
          },
          ended: createPendingPromise(),
          append: vi.fn((chunk: Uint8Array) => {
            appendedChunks.push(Array.from(chunk));
            duration += chunk.byteLength / 2 / sampleRate;
          }),
          finish: vi.fn(),
          stop: vi.fn(),
        };
      }),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const stream = vi.fn(async () => ({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 0]));
          controller.close();
        },
      }),
      sampleRate: 24000,
      channels: 1,
      sampleFormat: 's16le' as const,
    }));
    const synthesize = vi.fn(async () => new Blob(['wav fallback']));
    const player = new GaplessTtsPlayer({
      engine,
      synthesize,
      stream,
      startLeadSeconds: 0,
    });

    const nextParagraph = { ...createSegment(1), pIdx: 1 };
    player.start([createSegment(0), nextParagraph]);
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(2));

    expect(synthesize).not.toHaveBeenCalled();
    expect(appendedChunks).toEqual([[0, 0], [0, 0]]);
    expect(streamStarts[0]).toBe(0);
    expect(streamStarts[1]).toBeCloseTo(1 / 24000 + 0.56, 10);

    await player.stop();
  });

  it('prefetches and drains upcoming PCM streams while the current response is still flowing', async () => {
    let firstController: ReadableStreamDefaultController<Uint8Array> | undefined;
    let secondStreamPulls = 0;
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn(),
      beginPcmStream: vi.fn((sampleRate, _channels, startAt): PcmStreamPlayback => {
        let duration = 0;
        return {
          startAt,
          get duration() {
            return duration;
          },
          get endAt() {
            return startAt + duration;
          },
          ended: createPendingPromise(),
          append: (chunk: Uint8Array) => {
            duration += chunk.byteLength / 2 / sampleRate;
          },
          finish: vi.fn(),
          stop: vi.fn(),
        };
      }),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const stream = vi.fn(async (segment: SpeechSegment) => {
      const isFirstSegment = segment.text === 'Segment 0.';
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([0, 0]));
            if (isFirstSegment) firstController = controller;
          },
          pull(controller) {
            if (isFirstSegment) return;
            secondStreamPulls += 1;
            controller.enqueue(new Uint8Array([0, 0]));
            controller.close();
          },
        }),
        sampleRate: 24000,
        channels: 1,
        sampleFormat: 's16le' as const,
      };
    });
    const player = new GaplessTtsPlayer({
      engine,
      synthesize: vi.fn(async () => new Blob()),
      stream,
      startLeadSeconds: 0,
    });

    player.start([createSegment(0), createSegment(1)]);

    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(secondStreamPulls).toBeGreaterThan(0));
    firstController?.close();
    await player.stop();
  });

  it('honors the configured streaming prefetch window', async () => {
    let firstController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 2, value: null })),
      schedule: vi.fn(),
      beginPcmStream: vi.fn((_sampleRate, _channels, startAt): PcmStreamPlayback => ({
        startAt,
        duration: 0,
        endAt: startAt,
        ended: createPendingPromise(),
        append: vi.fn(),
        finish: vi.fn(),
        stop: vi.fn(),
      })),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const stream = vi.fn(async (segment: SpeechSegment) => ({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 0]));
          if (segment.text === 'Segment 0.') firstController = controller;
          else controller.close();
        },
      }),
      sampleRate: 24000,
      channels: 1,
      sampleFormat: 's16le' as const,
    }));
    const player = new GaplessTtsPlayer({
      engine,
      synthesize: vi.fn(async () => new Blob()),
      stream,
      prefetchAhead: 2,
    });

    player.start([createSegment(0), createSegment(1), createSegment(2), createSegment(3)]);

    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(3));
    expect(stream.mock.calls.map(([segment]) => segment.text)).toEqual([
      'Segment 0.',
      'Segment 1.',
      'Segment 2.',
    ]);

    firstController?.close();
    await player.stop();
  });

  it('falls back to decoded WAV when the PCM endpoint is unavailable', async () => {
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 1, value: null })),
      schedule: vi.fn((_audio, startAt): ScheduledAudio => ({
        endAt: startAt + 1,
        ended: createPendingPromise(),
        stop: vi.fn(),
      })),
      beginPcmStream: vi.fn(),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const stream = vi.fn(async () => {
      throw new Error('stream endpoint unavailable');
    });
    const synthesize = vi.fn(async () => new Blob(['wav fallback']));
    const player = new GaplessTtsPlayer({ engine, synthesize, stream, startLeadSeconds: 0 });

    player.start([createSegment(0)]);
    await vi.waitFor(() => expect(engine.schedule).toHaveBeenCalledTimes(1));

    expect(stream).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(engine.decode).toHaveBeenCalledTimes(1);

    await player.stop();
  });

  it('cleans up an empty PCM playback before falling back to decoded WAV', async () => {
    const stopPcm = vi.fn();
    let fallbackSignal: AbortSignal | undefined;
    const engine: AudioPlaybackEngine = {
      now: () => 0,
      decode: vi.fn(async (): Promise<DecodedAudio> => ({ duration: 1, value: null })),
      schedule: vi.fn((_audio, startAt): ScheduledAudio => ({
        endAt: startAt + 1,
        ended: createPendingPromise(),
        stop: vi.fn(),
      })),
      beginPcmStream: vi.fn((_sampleRate, _channels, startAt): PcmStreamPlayback => ({
        startAt,
        duration: 0,
        endAt: startAt,
        ended: createPendingPromise(),
        append: vi.fn(),
        finish: vi.fn(),
        stop: stopPcm,
      })),
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const stream = vi.fn(async () => ({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('stream body failed'));
        },
      }),
      sampleRate: 24000,
      channels: 1,
      sampleFormat: 's16le' as const,
    }));
    const synthesize = vi.fn(async (_segment: SpeechSegment, signal: AbortSignal) => {
      fallbackSignal = signal;
      return new Blob(['wav fallback']);
    });
    const player = new GaplessTtsPlayer({ engine, synthesize, stream, startLeadSeconds: 0 });

    player.start([createSegment(0)]);
    await vi.waitFor(() => expect(engine.schedule).toHaveBeenCalledTimes(1));

    expect(stopPcm).toHaveBeenCalledTimes(1);
    expect(fallbackSignal?.aborted).toBe(false);

    await player.stop();
  });
});

describe('WebAudioPlaybackEngine', () => {
  it('starts a decoded buffer at the requested audio-clock time', async () => {
    const nativeBuffer = { duration: 1.5 } as unknown as AudioBuffer;
    const source = {
      buffer: null as AudioBuffer | null,
      onended: null as (() => void) | null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const context = {
      currentTime: 3,
      destination: {},
      createBufferSource: vi.fn(() => source),
      decodeAudioData: vi.fn(async () => nativeBuffer),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const engine = new WebAudioPlaybackEngine(context);

    const scheduled = engine.schedule({ duration: 1.5, value: nativeBuffer }, 4);

    expect(source.buffer).toBe(nativeBuffer);
    expect(source.connect).toHaveBeenCalledWith(context.destination);
    expect(source.start).toHaveBeenCalledWith(4);
    expect(scheduled.endAt).toBe(5.5);

    source.onended?.();
    await expect(scheduled.ended).resolves.toBeUndefined();
  });

  it('scales playbackRate and endAt duration when playbackRate is specified', async () => {
    const nativeBuffer = { duration: 3.0 } as unknown as AudioBuffer;
    const playbackRateProperty = { value: 1.0 };
    const source = {
      buffer: null as AudioBuffer | null,
      playbackRate: playbackRateProperty,
      onended: null as (() => void) | null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const context = {
      currentTime: 0,
      destination: {},
      createBufferSource: vi.fn(() => source),
      decodeAudioData: vi.fn(async () => nativeBuffer),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const engine = new WebAudioPlaybackEngine(context, 1.5);

    const scheduled = engine.schedule({ duration: 3.0, value: nativeBuffer }, 2);

    expect(source.playbackRate.value).toBe(1.5);
    expect(scheduled.endAt).toBe(4.0); // 2 + (3.0 / 1.5) = 4.0
  });

  it('schedules split PCM network chunks on one continuous audio clock', () => {
    const starts: number[] = [];
    const sources: Array<{
      buffer: AudioBuffer | null;
      playbackRate: { value: number };
      onended: (() => void) | null;
      connect: ReturnType<typeof vi.fn>;
      start: (at: number) => void;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const context = {
      currentTime: 0,
      destination: {},
      createBuffer: vi.fn((_channels: number, frameCount: number, sampleRate: number) => ({
        duration: frameCount / sampleRate,
        copyToChannel: vi.fn(),
      })),
      createBufferSource: vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          playbackRate: { value: 1 },
          onended: null as (() => void) | null,
          connect: vi.fn(),
          start: (at: number) => starts.push(at),
          stop: vi.fn(),
        };
        sources.push(source);
        return source;
      }),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const engine = new WebAudioPlaybackEngine(context);
    const playback = engine.beginPcmStream(24000, 1, 2);

    playback.append(new Uint8Array([0, 0, 255]));
    playback.append(new Uint8Array([127]));
    playback.finish();

    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(starts).toEqual([2]);
    expect(playback.duration).toBeCloseTo(2 / 24000, 10);
    expect(playback.endAt).toBeCloseTo(2 + 2 / 24000, 10);
    expect(sources).toHaveLength(1);
  });

  it('starts a delayed first PCM chunk from the current audio clock instead of the past', () => {
    const starts: number[] = [];
    const context = {
      currentTime: 0,
      destination: {},
      createBuffer: vi.fn((_channels: number, frameCount: number, sampleRate: number) => ({
        duration: frameCount / sampleRate,
        copyToChannel: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: (at: number) => starts.push(at),
        stop: vi.fn(),
      })),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const engine = new WebAudioPlaybackEngine(context);
    const playback = engine.beginPcmStream(24000, 1, 0);

    Object.defineProperty(context, 'currentTime', { value: 5 });
    playback.append(new Uint8Array([0, 0]));
    playback.finish();

    expect(starts[0]).toBeCloseTo(5.03, 10);
    expect(playback.startAt).toBeCloseTo(5.03, 10);
  });

  it('holds the first PCM samples until the startup jitter buffer is ready', () => {
    const starts: number[] = [];
    const context = {
      currentTime: 0,
      destination: {},
      createBuffer: vi.fn((_channels: number, frameCount: number, sampleRate: number) => ({
        duration: frameCount / sampleRate,
        copyToChannel: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: (at: number) => starts.push(at),
        stop: vi.fn(),
      })),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const playback = new WebAudioPlaybackEngine(context).beginPcmStream(10, 1, 0);

    playback.append(new Uint8Array([0, 0]));
    expect(starts).toEqual([]);

    playback.append(new Uint8Array([0, 0]));
    expect(starts).toEqual([0.03]);
  });

  it('rebases a late PCM chunk onto the current audio clock instead of overlapping elapsed audio', () => {
    const starts: number[] = [];
    const context = {
      currentTime: 0,
      destination: {},
      createBuffer: vi.fn((_channels: number, frameCount: number, sampleRate: number) => ({
        duration: frameCount / sampleRate,
        copyToChannel: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: (at: number) => starts.push(at),
        stop: vi.fn(),
      })),
      suspend: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as unknown as AudioContext;
    const engine = new WebAudioPlaybackEngine(context);
    const playback = engine.beginPcmStream(2, 1, 0);

    playback.append(new Uint8Array([0, 0, 0, 0]));
    Object.defineProperty(context, 'currentTime', { value: 5 });
    playback.append(new Uint8Array([0, 0, 0, 0]));

    expect(starts).toEqual([0.03, 5.03]);
  });
});
