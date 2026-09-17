export interface SentenceChunk {
  pIdx: number;
  text: string;
  startOffset: number;
  length: number;
}

export interface SpeechSegment extends SentenceChunk {
  sentenceStartIndex: number;
  sentenceEndIndex: number;
}

export interface SpeechSegmentOptions {
  targetCharacters?: number;
  maxCharacters?: number;
}

export interface DecodedAudio {
  duration: number;
  value: unknown;
}

export interface WordCue {
  text: string;
  charIndex: number;
  charLength: number;
  startSeconds: number;
  endSeconds: number;
}

export interface ScheduledAudio {
  endAt: number;
  ended: Promise<void>;
  stop: () => void;
}

export interface PcmStreamPlayback extends ScheduledAudio {
  readonly startAt: number;
  readonly duration: number;
  append: (chunk: Uint8Array) => void;
  finish: () => void;
}

export interface PcmAudioStream {
  body: ReadableStream<Uint8Array>;
  sampleRate: number;
  channels: number;
}

export interface AudioPlaybackEngine {
  now: () => number;
  decode: (blob: Blob) => Promise<DecodedAudio>;
  schedule: (audio: DecodedAudio, startAt: number) => ScheduledAudio;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  dispose: () => Promise<void>;
  beginPcmStream?: (
    sampleRate: number,
    channels: number,
    startAt: number
  ) => PcmStreamPlayback;
  watchTime?: (callback: (currentTime: number) => void) => () => void;
  playbackRate?: number;
}

export interface GaplessTtsPlayerOptions {
  engine: AudioPlaybackEngine;
  synthesize: (segment: SpeechSegment, signal: AbortSignal) => Promise<Blob>;
  stream?: (segment: SpeechSegment, signal: AbortSignal) => Promise<PcmAudioStream>;
  speechRate?: number;
  startLeadSeconds?: number;
  prefetchAhead?: number;
}

export interface GaplessPlaybackCallbacks {
  onSegmentStart?: (segmentIndex: number, segment: SpeechSegment) => void;
  onWordBoundary?: (segmentIndex: number, segment: SpeechSegment, cue: WordCue) => void;
  onFinished?: () => void;
  onError?: (error: unknown) => void;
}

interface PlaybackSession {
  id: number;
  controller: AbortController;
  cancelled: Promise<void>;
  cancel: () => void;
  scheduledWordCues: Array<
    WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }
  >;
  nextWordCueIndex: number;
  stopWatchingTime?: () => void;
}

const MAX_PHRASE_CHARACTERS = 180;
const DEFAULT_TARGET_CHARACTERS = 320;
const DEFAULT_MAX_CHARACTERS = 480;
const WORD_PATTERN = /[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/gu;

function joinChunksPreservingOffsets(previous: SentenceChunk, next: SentenceChunk): string {
  const previousEndOffset = previous.startOffset + previous.length;
  const gapLength = Math.max(0, next.startOffset - previousEndOffset);

  return `${previous.text}${' '.repeat(gapLength)}${next.text}`;
}

function splitLongSpeechChunk(chunk: SentenceChunk): SentenceChunk[] {
  if (chunk.length <= MAX_PHRASE_CHARACTERS) return [chunk];

  const phrases: SentenceChunk[] = [];
  let cursor = 0;

  while (chunk.text.length - cursor > MAX_PHRASE_CHARACTERS) {
    const minimumNaturalBreak = Math.floor(MAX_PHRASE_CHARACTERS * 0.55);
    const candidate = chunk.text.slice(cursor, cursor + MAX_PHRASE_CHARACTERS + 1);
    let breakAt = -1;

    for (let index = MAX_PHRASE_CHARACTERS; index >= minimumNaturalBreak; index -= 1) {
      if (/[,;:]/u.test(candidate[index - 1] ?? '')) {
        breakAt = index;
        break;
      }
    }

    if (breakAt === -1) {
      for (let index = MAX_PHRASE_CHARACTERS; index >= minimumNaturalBreak; index -= 1) {
        if (/\s/u.test(candidate[index - 1] ?? '')) {
          breakAt = index - 1;
          break;
        }
      }
    }

    if (breakAt <= 0) breakAt = MAX_PHRASE_CHARACTERS;

    const rawPhrase = chunk.text.slice(cursor, cursor + breakAt);
    const leadingWhitespace = rawPhrase.length - rawPhrase.trimStart().length;
    const phraseText = rawPhrase.trim();
    if (phraseText) {
      phrases.push({
        pIdx: chunk.pIdx,
        text: phraseText,
        startOffset: chunk.startOffset + cursor + leadingWhitespace,
        length: phraseText.length,
      });
    }
    cursor += breakAt;
  }

  const rawRemainder = chunk.text.slice(cursor);
  const leadingWhitespace = rawRemainder.length - rawRemainder.trimStart().length;
  const remainderText = rawRemainder.trim();
  if (remainderText) {
    phrases.push({
      pIdx: chunk.pIdx,
      text: remainderText,
      startOffset: chunk.startOffset + cursor + leadingWhitespace,
      length: remainderText.length,
    });
  }

  return phrases;
}

export function splitParagraphIntoSentences(text: string, pIdx: number): SentenceChunk[] {
  if (!text || !text.trim()) return [];

  const sentenceRegex = /[^.!?…\n]+[.!?…\n]*/g;
  const sentences: SentenceChunk[] = [];
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const rawSentence = match[0];
    const trimmedSentence = rawSentence.trim();
    if (!trimmedSentence) continue;

    const leadingSpaces = rawSentence.length - rawSentence.trimStart().length;
    const sentence = {
      pIdx,
      text: trimmedSentence,
      startOffset: match.index + leadingSpaces,
      length: trimmedSentence.length,
    };
    sentences.push(...splitLongSpeechChunk(sentence));
  }

  if (sentences.length === 0 && text.trim()) {
    const trimmedText = text.trim();
    sentences.push({
      pIdx,
      text: trimmedText,
      startOffset: text.length - text.trimStart().length,
      length: trimmedText.length,
    });
  }

  const mergedSentences: SentenceChunk[] = [];
  sentences.forEach((sentence) => {
    const previous = mergedSentences.at(-1);
    if (previous && previous.pIdx === sentence.pIdx && sentence.text.length < 10) {
      const combinedText = joinChunksPreservingOffsets(previous, sentence);
      if (combinedText.length <= MAX_PHRASE_CHARACTERS) {
        previous.text = combinedText;
        previous.length = previous.text.length;
        return;
      }
    }
    mergedSentences.push({ ...sentence });
  });

  return mergedSentences;
}

export function buildSpeechSegments(
  sentences: SentenceChunk[],
  options: SpeechSegmentOptions = {}
): SpeechSegment[] {
  const maxCharacters = Math.max(1, options.maxCharacters ?? DEFAULT_MAX_CHARACTERS);
  const targetCharacters = Math.min(
    Math.max(1, options.targetCharacters ?? DEFAULT_TARGET_CHARACTERS),
    maxCharacters
  );
  const segments: SpeechSegment[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    const previous = segments.at(-1);
    const combinedText =
      previous && previous.pIdx === sentence.pIdx
        ? joinChunksPreservingOffsets(previous, sentence)
        : sentence.text;
    const mustStartNewSegment =
      !previous ||
      previous.pIdx !== sentence.pIdx ||
      previous.text.length >= targetCharacters ||
      combinedText.length > maxCharacters;

    if (mustStartNewSegment) {
      segments.push({
        ...sentence,
        sentenceStartIndex: sentenceIndex,
        sentenceEndIndex: sentenceIndex,
      });
      return;
    }

    previous.text = combinedText;
    previous.length = combinedText.length;
    previous.sentenceEndIndex = sentenceIndex;
  });

  return segments;
}

export function buildWordTimeline(text: string, audioDurationSeconds: number): WordCue[] {
  if (!text.trim() || audioDurationSeconds <= 0) return [];

  const matches = Array.from(text.matchAll(WORD_PATTERN));
  if (matches.length === 0) return [];

  const weightedWords = matches.map((match, index) => {
    const charIndex = match.index ?? 0;
    const word = match[0];
    const nextCharIndex = matches[index + 1]?.index ?? text.length;
    const trailingText = text.slice(charIndex + word.length, nextCharIndex);
    const wordWeight = 1 + Math.min(word.length, 12) * 0.02;
    const pauseWeight = /[.!?…]/u.test(trailingText)
      ? 0.9
      : /[,;:]/u.test(trailingText)
      ? 0.35
      : 0;

    return {
      text: word,
      charIndex,
      charLength: word.length,
      wordWeight,
      totalWeight: wordWeight + pauseWeight,
    };
  });
  const totalWeight = weightedWords.reduce((total, word) => total + word.totalWeight, 0);
  const edgePadding = Math.min(0.08, audioDurationSeconds * 0.03);
  const spokenDuration = Math.max(0, audioDurationSeconds - edgePadding * 2);
  let elapsedWeight = 0;

  return weightedWords.map((word) => {
    const startSeconds = edgePadding + (elapsedWeight / totalWeight) * spokenDuration;
    const endSeconds = startSeconds + (word.wordWeight / totalWeight) * spokenDuration;
    elapsedWeight += word.totalWeight;
    return {
      text: word.text,
      charIndex: word.charIndex,
      charLength: word.charLength,
      startSeconds,
      endSeconds,
    };
  });
}

export class GaplessTtsPlayer {
  private readonly engine: AudioPlaybackEngine;
  private readonly synthesize: GaplessTtsPlayerOptions['synthesize'];
  private readonly stream?: GaplessTtsPlayerOptions['stream'];
  private readonly speechRate: number;
  private readonly startLeadSeconds: number;
  private readonly prefetchAhead: number;
  private readonly scheduledAudio = new Set<ScheduledAudio>();
  private activeSession: PlaybackSession | null = null;
  private nextSessionId = 1;

  constructor(options: GaplessTtsPlayerOptions) {
    this.engine = options.engine;
    this.synthesize = options.synthesize;
    this.stream = options.stream;
    this.speechRate = Math.max(0.25, Math.min(options.speechRate ?? 1.0, 4.0));
    this.startLeadSeconds = Math.max(0, options.startLeadSeconds ?? 0.03);
    this.prefetchAhead = Math.max(1, Math.floor(options.prefetchAhead ?? 2));
  }

  public start(segments: SpeechSegment[], callbacks: GaplessPlaybackCallbacks = {}): void {
    this.cancelActiveSession();
    if (segments.length === 0) {
      callbacks.onFinished?.();
      return;
    }

    let cancelSession = () => {};
    const session: PlaybackSession = {
      id: this.nextSessionId++,
      controller: new AbortController(),
      cancelled: new Promise<void>((resolve) => {
        cancelSession = resolve;
      }),
      cancel: () => cancelSession(),
      scheduledWordCues: [],
      nextWordCueIndex: 0,
    };
    this.activeSession = session;

    const supportsStreaming = Boolean(this.stream && this.engine.beginPcmStream);
    void this.engine.resume().then(
      () => supportsStreaming
        ? this.runStreaming(session, segments, callbacks)
        : this.run(session, segments, callbacks),
      (error: unknown) => callbacks.onError?.(error)
    );
  }

  public async pause(): Promise<void> {
    await this.engine.pause();
  }

  public async resume(): Promise<void> {
    await this.engine.resume();
  }

  public async stop(): Promise<void> {
    this.cancelActiveSession();
  }

  public async dispose(): Promise<void> {
    this.cancelActiveSession();
    await this.engine.dispose();
  }

  private async run(
    session: PlaybackSession,
    segments: SpeechSegment[],
    callbacks: GaplessPlaybackCallbacks
  ): Promise<void> {
    try {
      const preparedAudio = new Map<number, Promise<DecodedAudio>>();
      const ensurePrepared = (index: number): Promise<DecodedAudio> | undefined => {
        if (index < 0 || index >= segments.length) return undefined;

        let prepared = preparedAudio.get(index);
        if (!prepared) {
          prepared = this.prepareSegment(session, segments[index]);
          preparedAudio.set(index, prepared);
          void prepared.catch(() => {});
        }
        return prepared;
      };
      const prefetchAfter = (index: number) => {
        for (let offset = 1; offset <= this.prefetchAhead; offset += 1) {
          ensurePrepared(index + offset);
        }
      };

      const firstAudio = await ensurePrepared(0)!;
      if (!this.isActive(session)) return;

      const firstStartAt = this.engine.now() + this.startLeadSeconds;
      let currentPlayback = this.scheduleAudio(firstAudio, firstStartAt);
      preparedAudio.delete(0);
      prefetchAfter(0);
      this.queueWordCues(session, 0, segments[0], firstAudio, firstStartAt);
      this.startWordTracking(session, callbacks);
      callbacks.onSegmentStart?.(0, segments[0]);

      for (let index = 1; index < segments.length; index += 1) {
        const nextAudio = await ensurePrepared(index)!;
        if (!this.isActive(session)) return;
        preparedAudio.delete(index);

        const nextStartAt = Math.max(
          currentPlayback.endAt,
          this.engine.now() + this.startLeadSeconds
        );
        const nextPlayback = this.scheduleAudio(nextAudio, nextStartAt);
        this.queueWordCues(session, index, segments[index], nextAudio, nextStartAt);

        await Promise.race([currentPlayback.ended, session.cancelled]);
        this.scheduledAudio.delete(currentPlayback);
        if (!this.isActive(session)) return;

        callbacks.onSegmentStart?.(index, segments[index]);
        currentPlayback = nextPlayback;
        prefetchAfter(index);
      }

      await Promise.race([currentPlayback.ended, session.cancelled]);
      this.scheduledAudio.delete(currentPlayback);
      if (!this.isActive(session)) return;

      session.stopWatchingTime?.();
      this.activeSession = null;
      callbacks.onFinished?.();
    } catch (error: unknown) {
      if (!this.isActive(session)) return;
      this.cancelActiveSession();
      callbacks.onError?.(error);
    }
  }

  private async runStreaming(
    session: PlaybackSession,
    segments: SpeechSegment[],
    callbacks: GaplessPlaybackCallbacks
  ): Promise<void> {
    let hasScheduledAudio = false;

    try {
      let previousPlayback: PcmStreamPlayback | null = null;

      for (let index = 0; index < segments.length; index += 1) {
        if (!this.stream || !this.engine.beginPcmStream) return;

        const segment = segments[index];
        const audioStream = await this.stream(segment, session.controller.signal);
        if (!this.isActive(session)) return;

        const startAt = previousPlayback
          ? previousPlayback.endAt
          : this.engine.now() + this.startLeadSeconds;
        const playback = this.engine.beginPcmStream(
          audioStream.sampleRate,
          audioStream.channels,
          startAt
        );
        this.scheduledAudio.add(playback);
        const reader = audioStream.body.getReader();
        let hasSegmentAudio = false;
        let segmentCues: Array<
          WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }
        > = [];

        try {
          while (this.isActive(session)) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;

            playback.append(value);
            if (!hasSegmentAudio && playback.duration > 0) {
              hasSegmentAudio = true;
              hasScheduledAudio = true;

              const estimatedDuration = this.estimateSpeechDuration(segment.text);
              segmentCues = this.queueWordCuesForDuration(
                session,
                index,
                segment,
                estimatedDuration,
                playback.startAt
              );
              this.startWordTracking(session, callbacks);

              if (previousPlayback) {
                const priorPlayback = previousPlayback;
                void Promise.race([priorPlayback.ended, session.cancelled]).then(() => {
                  if (this.isActive(session)) {
                    callbacks.onSegmentStart?.(index, segment);
                  }
                });
              } else {
                callbacks.onSegmentStart?.(index, segment);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (!this.isActive(session)) return;
        if (!hasSegmentAudio) {
          throw new Error('TTS streaming returned no audio');
        }

        playback.finish();
        this.correctPendingWordCues(segmentCues, segment.text, playback.duration, playback.startAt);
        void playback.ended.then(() => this.scheduledAudio.delete(playback));
        previousPlayback = playback;
      }

      if (!previousPlayback) return;
      await Promise.race([previousPlayback.ended, session.cancelled]);
      if (!this.isActive(session)) return;

      session.stopWatchingTime?.();
      this.activeSession = null;
      callbacks.onFinished?.();
    } catch (error: unknown) {
      if (!this.isActive(session)) return;
      if (!hasScheduledAudio) {
        await this.run(session, segments, callbacks);
        return;
      }
      this.cancelActiveSession();
      callbacks.onError?.(error);
    }
  }

  private async prepareSegment(session: PlaybackSession, segment: SpeechSegment): Promise<DecodedAudio> {
    const blob = await this.synthesize(segment, session.controller.signal);
    return this.engine.decode(blob);
  }

  private scheduleAudio(audio: DecodedAudio, startAt: number): ScheduledAudio {
    const scheduled = this.engine.schedule(audio, startAt);
    this.scheduledAudio.add(scheduled);
    return scheduled;
  }

  private queueWordCues(
    session: PlaybackSession,
    segmentIndex: number,
    segment: SpeechSegment,
    audio: DecodedAudio,
    startAt: number
  ): void {
    const rate = this.engine.playbackRate && this.engine.playbackRate > 0 ? this.engine.playbackRate : 1.0;
    const effectiveDuration = audio.duration / rate;
    this.queueWordCuesForDuration(
      session,
      segmentIndex,
      segment,
      effectiveDuration,
      startAt
    );
  }

  private queueWordCuesForDuration(
    session: PlaybackSession,
    segmentIndex: number,
    segment: SpeechSegment,
    duration: number,
    startAt: number
  ): Array<WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }> {
    const scheduled = buildWordTimeline(segment.text, duration).map((cue) => ({
        ...cue,
        absoluteStart: startAt + cue.startSeconds,
        segmentIndex,
        segment,
      }));
    session.scheduledWordCues.push(...scheduled);
    return scheduled;
  }

  private estimateSpeechDuration(text: string): number {
    const playbackRate =
      this.engine.playbackRate && this.engine.playbackRate > 0
        ? this.engine.playbackRate
        : 1.0;
    return Math.max(0.6, text.length / 18) / this.speechRate / playbackRate;
  }

  private correctPendingWordCues(
    scheduled: Array<WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }>,
    text: string,
    duration: number,
    startAt: number
  ): void {
    const corrected = buildWordTimeline(text, duration);
    const now = this.engine.now();
    scheduled.forEach((cue, index) => {
      const nextCue = corrected[index];
      if (!nextCue || cue.absoluteStart <= now) return;
      cue.startSeconds = nextCue.startSeconds;
      cue.endSeconds = nextCue.endSeconds;
      cue.absoluteStart = startAt + nextCue.startSeconds;
    });
  }

  private startWordTracking(session: PlaybackSession, callbacks: GaplessPlaybackCallbacks): void {
    if (!callbacks.onWordBoundary || !this.engine.watchTime || session.stopWatchingTime) return;

    session.stopWatchingTime = this.engine.watchTime((currentTime) => {
      if (!this.isActive(session)) return;

      while (session.nextWordCueIndex < session.scheduledWordCues.length) {
        const cue = session.scheduledWordCues[session.nextWordCueIndex];
        if (cue.absoluteStart > currentTime) break;

        callbacks.onWordBoundary?.(cue.segmentIndex, cue.segment, cue);
        session.nextWordCueIndex += 1;
      }
    });
  }

  private isActive(session: PlaybackSession): boolean {
    return this.activeSession?.id === session.id && !session.controller.signal.aborted;
  }

  private cancelActiveSession(): void {
    if (this.activeSession) {
      this.activeSession.stopWatchingTime?.();
      this.activeSession.controller.abort();
      this.activeSession.cancel();
      this.activeSession = null;
    }

    this.scheduledAudio.forEach((audio) => audio.stop());
    this.scheduledAudio.clear();
  }
}

export class WebAudioPlaybackEngine implements AudioPlaybackEngine {
  public readonly playbackRate: number;

  constructor(private readonly context: AudioContext, playbackRate: number = 1.0) {
    this.playbackRate = Math.max(0.25, Math.min(playbackRate, 4.0));
  }

  public now(): number {
    return this.context.currentTime;
  }

  public async decode(blob: Blob): Promise<DecodedAudio> {
    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
    return {
      duration: buffer.duration,
      value: buffer,
    };
  }

  public schedule(audio: DecodedAudio, startAt: number): ScheduledAudio {
    const source = this.context.createBufferSource();
    source.buffer = audio.value as AudioBuffer;
    if (this.playbackRate !== 1.0) {
      source.playbackRate.value = this.playbackRate;
    }
    source.connect(this.context.destination);

    let resolveEnded = () => {};
    let hasEnded = false;
    const ended = new Promise<void>((resolve) => {
      resolveEnded = resolve;
    });
    const settle = () => {
      if (hasEnded) return;
      hasEnded = true;
      resolveEnded();
    };

    source.onended = settle;
    source.start(startAt);

    const scaledDuration = audio.duration / this.playbackRate;
    return {
      endAt: startAt + scaledDuration,
      ended,
      stop: () => {
        if (hasEnded) return;
        try {
          source.stop();
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
            throw error;
          }
        } finally {
          settle();
        }
      },
    };
  }

  public beginPcmStream(
    sampleRate: number,
    channels: number,
    startAt: number
  ): PcmStreamPlayback {
    if (channels !== 1) {
      throw new Error(`Unsupported PCM channel count: ${channels}`);
    }

    const sources = new Set<AudioBufferSourceNode>();
    let cursor = startAt;
    let actualStartAt: number | undefined;
    let pendingByte: number | undefined;
    let isFinished = false;
    let hasSettled = false;
    let resolveEnded = () => {};
    const ended = new Promise<void>((resolve) => {
      resolveEnded = resolve;
    });
    const settleIfDone = () => {
      if (hasSettled || !isFinished || sources.size > 0) return;
      hasSettled = true;
      resolveEnded();
    };

    const playback: PcmStreamPlayback = {
      get startAt() {
        return actualStartAt ?? startAt;
      },
      get duration() {
        return actualStartAt === undefined ? 0 : cursor - actualStartAt;
      },
      get endAt() {
        return cursor;
      },
      ended,
      append: (chunk: Uint8Array) => {
        if (isFinished) throw new Error('Cannot append PCM after the stream has finished');
        if (chunk.byteLength === 0) return;

        let bytes = chunk;
        if (pendingByte !== undefined) {
          bytes = new Uint8Array(chunk.byteLength + 1);
          bytes[0] = pendingByte;
          bytes.set(chunk, 1);
          pendingByte = undefined;
        }
        if (bytes.byteLength % 2 === 1) {
          pendingByte = bytes[bytes.byteLength - 1];
          bytes = bytes.subarray(0, bytes.byteLength - 1);
        }
        if (bytes.byteLength === 0) return;

        if (actualStartAt === undefined) {
          actualStartAt = Math.max(startAt, this.context.currentTime + 0.03);
          cursor = actualStartAt;
        }

        const frameCount = bytes.byteLength / 2;
        const samples = new Float32Array(frameCount);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let index = 0; index < frameCount; index += 1) {
          samples[index] = view.getInt16(index * 2, true) / 32768;
        }

        const buffer = this.context.createBuffer(1, frameCount, sampleRate);
        buffer.copyToChannel(samples, 0);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        if (this.playbackRate !== 1.0) {
          source.playbackRate.value = this.playbackRate;
        }
        source.connect(this.context.destination);
        sources.add(source);
        source.onended = () => {
          sources.delete(source);
          settleIfDone();
        };
        if (cursor < this.context.currentTime) {
          cursor = this.context.currentTime + 0.03;
        }
        source.start(cursor);
        cursor += buffer.duration / this.playbackRate;
      },
      finish: () => {
        if (pendingByte !== undefined) {
          throw new Error('PCM stream ended with an incomplete sample');
        }
        isFinished = true;
        settleIfDone();
      },
      stop: () => {
        if (hasSettled) return;
        isFinished = true;
        sources.forEach((source) => {
          try {
            source.stop();
          } catch (error: unknown) {
            if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
              throw error;
            }
          }
        });
        sources.clear();
        settleIfDone();
      },
    };

    return playback;
  }

  public async pause(): Promise<void> {
    if (this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  public async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  public async dispose(): Promise<void> {
    if (this.context.state !== 'closed') {
      await this.context.close();
    }
  }

  public watchTime(callback: (currentTime: number) => void): () => void {
    let animationFrameId = 0;
    let isWatching = true;
    const tick = () => {
      if (!isWatching) return;
      callback(this.context.currentTime);
      animationFrameId = requestAnimationFrame(tick);
    };
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      isWatching = false;
      cancelAnimationFrame(animationFrameId);
    };
  }
}
