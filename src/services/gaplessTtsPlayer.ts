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

export interface AudioPlaybackEngine {
  now: () => number;
  decode: (blob: Blob) => Promise<DecodedAudio>;
  schedule: (audio: DecodedAudio, startAt: number) => ScheduledAudio;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  dispose: () => Promise<void>;
  watchTime?: (callback: (currentTime: number) => void) => () => void;
  playbackRate?: number;
}

export interface GaplessTtsPlayerOptions {
  engine: AudioPlaybackEngine;
  synthesize: (segment: SpeechSegment, signal: AbortSignal) => Promise<Blob>;
  startLeadSeconds?: number;
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

const DEFAULT_TARGET_CHARACTERS = 260;
const DEFAULT_MAX_CHARACTERS = 340;
const WORD_PATTERN = /[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/gu;

function joinChunksPreservingOffsets(previous: SentenceChunk, next: SentenceChunk): string {
  const previousEndOffset = previous.startOffset + previous.length;
  const gapLength = Math.max(0, next.startOffset - previousEndOffset);

  return `${previous.text}${' '.repeat(gapLength)}${next.text}`;
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
    sentences.push({
      pIdx,
      text: trimmedSentence,
      startOffset: match.index + leadingSpaces,
      length: trimmedSentence.length,
    });
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
      previous.text = joinChunksPreservingOffsets(previous, sentence);
      previous.length = previous.text.length;
      return;
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
  private readonly startLeadSeconds: number;
  private readonly scheduledAudio = new Set<ScheduledAudio>();
  private activeSession: PlaybackSession | null = null;
  private nextSessionId = 1;

  constructor(options: GaplessTtsPlayerOptions) {
    this.engine = options.engine;
    this.synthesize = options.synthesize;
    this.startLeadSeconds = Math.max(0, options.startLeadSeconds ?? 0.03);
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

    void this.engine.resume().then(
      () => this.run(session, segments, callbacks),
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
      const firstAudio = await this.prepareSegment(session, segments[0]);
      if (!this.isActive(session)) return;

      const firstStartAt = this.engine.now() + this.startLeadSeconds;
      let currentPlayback = this.scheduleAudio(firstAudio, firstStartAt);
      this.queueWordCues(session, 0, segments[0], firstAudio, firstStartAt);
      this.startWordTracking(session, callbacks);
      callbacks.onSegmentStart?.(0, segments[0]);

      for (let index = 1; index < segments.length; index += 1) {
        const nextAudio = await this.prepareSegment(session, segments[index]);
        if (!this.isActive(session)) return;

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
    buildWordTimeline(segment.text, effectiveDuration).forEach((cue) => {
      session.scheduledWordCues.push({
        ...cue,
        absoluteStart: startAt + cue.startSeconds,
        segmentIndex,
        segment,
      });
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
