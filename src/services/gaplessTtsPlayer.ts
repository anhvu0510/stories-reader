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

export interface SentenceSplitOptions {
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

interface PrefetchedPcmStream {
  sampleRate: number;
  channels: number;
  read: () => Promise<ReadableStreamReadResult<Uint8Array>>;
}

const MAX_PHRASE_CHARACTERS = 180;
const DEFAULT_TARGET_CHARACTERS = 160;
const DEFAULT_MAX_CHARACTERS = MAX_PHRASE_CHARACTERS;
const WORD_PATTERN = /[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/gu;
const SPEECH_BATCH_PAUSE_SECONDS = 0.16;
const PARAGRAPH_PAUSE_SECONDS = 0.4;
const CLAUSE_PAUSE_SECONDS = 0.08;
const SOFT_BREAK_PAUSE_SECONDS = 0.06;
const STREAM_PREFETCH_BUFFER_SECONDS = 4;
const PCM_INITIAL_BUFFER_SECONDS = 0.2;
const PCM_STEADY_BUFFER_SECONDS = 0.1;
const PCM_SCHEDULE_LEAD_SECONDS = 0.03;

class BoundedPcmStreamBuffer {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly maxBufferedBytes: number;
  private readonly abortSignal: AbortSignal;
  private readonly chunks: Uint8Array[] = [];
  private readonly readWaiters: Array<{
    resolve: (result: ReadableStreamReadResult<Uint8Array>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private readonly capacityWaiters: Array<() => void> = [];
  private bufferedBytes = 0;
  private isDone = false;
  private failure: unknown = null;

  constructor(
    body: ReadableStream<Uint8Array>,
    maxBufferedBytes: number,
    abortSignal: AbortSignal
  ) {
    this.reader = body.getReader();
    this.maxBufferedBytes = Math.max(1, maxBufferedBytes);
    this.abortSignal = abortSignal;
    this.abortSignal.addEventListener('abort', this.handleAbort, { once: true });
    void this.pump();
  }

  public async read(): Promise<ReadableStreamReadResult<Uint8Array>> {
    const chunk = this.chunks.shift();
    if (chunk) {
      this.bufferedBytes -= chunk.byteLength;
      this.releaseCapacity();
      return { done: false, value: chunk };
    }
    if (this.failure) throw this.failure;
    if (this.isDone) return { done: true, value: undefined };

    return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
      this.readWaiters.push({ resolve, reject });
    });
  }

  private readonly handleAbort = () => {
    void this.reader.cancel().catch(() => {});
    this.finish();
  };

  private async pump(): Promise<void> {
    try {
      while (!this.abortSignal.aborted) {
        await this.waitForCapacity();
        if (this.abortSignal.aborted) break;

        const result = await this.reader.read();
        if (result.done) {
          this.finish();
          return;
        }
        if (!result.value || result.value.byteLength === 0) continue;

        const waiter = this.readWaiters.shift();
        if (waiter) {
          waiter.resolve({ done: false, value: result.value });
        } else {
          this.chunks.push(result.value);
          this.bufferedBytes += result.value.byteLength;
        }
      }
      this.finish();
    } catch (error: unknown) {
      if (this.abortSignal.aborted) {
        this.finish();
      } else {
        this.fail(error);
      }
    } finally {
      this.abortSignal.removeEventListener('abort', this.handleAbort);
      this.reader.releaseLock();
    }
  }

  private async waitForCapacity(): Promise<void> {
    if (this.bufferedBytes < this.maxBufferedBytes) return;
    await new Promise<void>((resolve) => {
      this.capacityWaiters.push(resolve);
    });
  }

  private releaseCapacity(): void {
    if (this.bufferedBytes >= this.maxBufferedBytes) return;
    this.capacityWaiters.splice(0).forEach((resolve) => resolve());
  }

  private finish(): void {
    if (this.isDone) return;
    this.isDone = true;
    this.capacityWaiters.splice(0).forEach((resolve) => resolve());
    this.readWaiters.splice(0).forEach(({ resolve }) => {
      resolve({ done: true, value: undefined });
    });
  }

  private fail(error: unknown): void {
    this.failure = error;
    this.isDone = true;
    this.capacityWaiters.splice(0).forEach((resolve) => resolve());
    this.readWaiters.splice(0).forEach(({ reject }) => reject(error));
  }
}

function getBoundaryPauseSeconds(previous: SpeechSegment, next: SpeechSegment): number {
  if (previous.pIdx !== next.pIdx) return PARAGRAPH_PAUSE_SECONDS;

  const ending = previous.text.trimEnd();
  if (/[.!?…]["'”’)\]]*$/u.test(ending)) return SPEECH_BATCH_PAUSE_SECONDS;
  if (/[,;:]["'”’)\]]*$/u.test(ending)) return CLAUSE_PAUSE_SECONDS;
  return SOFT_BREAK_PAUSE_SECONDS;
}

function joinChunksPreservingOffsets(previous: SentenceChunk, next: SentenceChunk): string {
  const previousEndOffset = previous.startOffset + previous.length;
  const gapLength = Math.max(0, next.startOffset - previousEndOffset);

  return `${previous.text}${' '.repeat(gapLength)}${next.text}`;
}

function splitLongSpeechChunk(
  chunk: SentenceChunk,
  maxCharacters: number
): SentenceChunk[] {
  if (chunk.length <= maxCharacters) return [chunk];

  const phrases: SentenceChunk[] = [];
  let cursor = 0;

  while (chunk.text.length - cursor > maxCharacters) {
    const minimumNaturalBreak = Math.floor(maxCharacters * 0.55);
    const candidate = chunk.text.slice(cursor, cursor + maxCharacters + 1);
    let breakAt = -1;

    for (let index = maxCharacters; index >= minimumNaturalBreak; index -= 1) {
      if (/[,;:]/u.test(candidate[index - 1] ?? '')) {
        breakAt = index;
        break;
      }
    }

    if (breakAt === -1) {
      for (let index = maxCharacters; index >= minimumNaturalBreak; index -= 1) {
        if (/\s/u.test(candidate[index - 1] ?? '')) {
          breakAt = index - 1;
          break;
        }
      }
    }

    if (breakAt <= 0) breakAt = maxCharacters;

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

export function splitParagraphIntoSentences(
  text: string,
  pIdx: number,
  options: SentenceSplitOptions = {}
): SentenceChunk[] {
  if (!text || !text.trim()) return [];

  const maxCharacters = Math.max(1, options.maxCharacters ?? MAX_PHRASE_CHARACTERS);

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
    sentences.push(...splitLongSpeechChunk(sentence, maxCharacters));
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
      if (combinedText.length <= maxCharacters) {
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
          currentPlayback.endAt + getBoundaryPauseSeconds(segments[index - 1], segments[index]),
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
      const preparedStreams = new Map<number, Promise<PrefetchedPcmStream>>();
      const ensureStream = (index: number): Promise<PrefetchedPcmStream> | undefined => {
        if (!this.stream || index < 0 || index >= segments.length) return undefined;

        let prepared = preparedStreams.get(index);
        if (!prepared) {
          prepared = this.prepareStreamingSegment(session, segments[index]);
          preparedStreams.set(index, prepared);
          void prepared.catch(() => {});
        }
        return prepared;
      };
      const prefetchAfter = (index: number) => {
        for (let offset = 1; offset <= this.prefetchAhead; offset += 1) {
          ensureStream(index + offset);
        }
      };

      ensureStream(0);
      prefetchAfter(0);

      for (let index = 0; index < segments.length; index += 1) {
        if (!this.engine.beginPcmStream) return;

        const segment = segments[index];
        const audioStream = await ensureStream(index)!;
        if (!this.isActive(session)) return;
        preparedStreams.delete(index);
        prefetchAfter(index);

        const startAt = previousPlayback
          ? previousPlayback.endAt + getBoundaryPauseSeconds(segments[index - 1], segment)
          : this.engine.now() + this.startLeadSeconds;
        const playback = this.engine.beginPcmStream(
          audioStream.sampleRate,
          audioStream.channels,
          startAt
        );
        this.scheduledAudio.add(playback);
        let hasSegmentAudio = false;
        let segmentCues: Array<
          WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }
        > = [];
        const startSegmentPlayback = () => {
          if (hasSegmentAudio || playback.duration <= 0) return;
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
        };

        while (this.isActive(session)) {
          const { value, done } = await audioStream.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;

          playback.append(value);
          startSegmentPlayback();
        }

        if (!this.isActive(session)) return;
        playback.finish();
        startSegmentPlayback();
        if (!hasSegmentAudio) {
          throw new Error('TTS streaming returned no audio');
        }

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
        session.controller.abort();
        session.controller = new AbortController();
        this.stopScheduledAudio();
        await this.run(session, segments, callbacks);
        return;
      }
      this.cancelActiveSession();
      callbacks.onError?.(error);
    }
  }

  private async prepareStreamingSegment(
    session: PlaybackSession,
    segment: SpeechSegment
  ): Promise<PrefetchedPcmStream> {
    if (!this.stream) {
      throw new Error('TTS streaming is unavailable');
    }

    const audioStream = await this.stream(segment, session.controller.signal);
    const bytesPerSecond = audioStream.sampleRate * audioStream.channels * 2;
    const buffer = new BoundedPcmStreamBuffer(
      audioStream.body,
      bytesPerSecond * STREAM_PREFETCH_BUFFER_SECONDS,
      session.controller.signal
    );

    return {
      sampleRate: audioStream.sampleRate,
      channels: audioStream.channels,
      read: () => buffer.read(),
    };
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

    this.stopScheduledAudio();
  }

  private stopScheduledAudio(): void {
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
    let pendingChunks: Uint8Array[] = [];
    let pendingByteLength = 0;
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
    const initialBufferBytes = Math.max(
      2,
      Math.ceil(sampleRate * PCM_INITIAL_BUFFER_SECONDS) * 2
    );
    const steadyBufferBytes = Math.max(
      2,
      Math.ceil(sampleRate * PCM_STEADY_BUFFER_SECONDS) * 2
    );

    const schedulePendingPcm = (force: boolean) => {
      const minimumBytes = actualStartAt === undefined
        ? initialBufferBytes
        : steadyBufferBytes;
      if (pendingByteLength === 0 || (!force && pendingByteLength < minimumBytes)) return;

      const bytes = new Uint8Array(pendingByteLength);
      let writeOffset = 0;
      pendingChunks.forEach((chunk) => {
        bytes.set(chunk, writeOffset);
        writeOffset += chunk.byteLength;
      });
      pendingChunks = [];
      pendingByteLength = 0;

      if (actualStartAt === undefined) {
        actualStartAt = Math.max(
          startAt,
          this.context.currentTime + PCM_SCHEDULE_LEAD_SECONDS
        );
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
        cursor = this.context.currentTime + PCM_SCHEDULE_LEAD_SECONDS;
      }
      source.start(cursor);
      cursor += buffer.duration / this.playbackRate;
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

        pendingChunks.push(bytes);
        pendingByteLength += bytes.byteLength;
        schedulePendingPcm(false);
      },
      finish: () => {
        if (pendingByte !== undefined) {
          throw new Error('PCM stream ended with an incomplete sample');
        }
        schedulePendingPcm(true);
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
        pendingChunks = [];
        pendingByteLength = 0;
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
