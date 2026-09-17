import { describe, expect, it, vi } from 'vitest';
import {
  buildSpeechSegments,
  buildWordTimeline,
  GaplessTtsPlayer,
  splitParagraphIntoSentences,
  WebAudioPlaybackEngine,
  type AudioPlaybackEngine,
  type DecodedAudio,
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
  it('schedules a ready segment exactly when the previous segment ends', async () => {
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
        text: 'Segment một.',
        startOffset: 0,
        length: 12,
        sentenceStartIndex: 0,
        sentenceEndIndex: 0,
      },
      {
        pIdx: 0,
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

    expect(scheduledStarts).toEqual([0, 2]);
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
});
