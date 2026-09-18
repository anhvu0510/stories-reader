import { INVISIBLE_SENTENCE_DELIMITER } from '../shared/constants/textBoundaries';
import soundTouchProcessorUrl from '@soundtouchjs/audio-worklet/processor?url';

export { INVISIBLE_SENTENCE_DELIMITER } from '../shared/constants/textBoundaries';

export interface SentenceChunk {
  pIdx: number;
  text: string;
  startOffset: number;
  length: number;
  /** True when the chunk was split only to satisfy the TTS request limit. */
  artificialSplit?: boolean;
  /** True when the API explicitly ended a grouped source line here. */
  explicitBoundary?: boolean;
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
  /** Prefetch complete source paragraphs instead of a fixed number of segments. */
  prefetchByParagraph?: boolean;
  /** Number of paragraphs to keep prepared ahead of the currently playing one. */
  prefetchParagraphsAhead?: number;
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
  chunks: Uint8Array[];
  byteLength: number;
}

const MAX_PHRASE_CHARACTERS = 180;
const DEFAULT_TARGET_CHARACTERS = 160;
const DEFAULT_MAX_CHARACTERS = MAX_PHRASE_CHARACTERS;
const WORD_PATTERN = /[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/gu;
interface BoundaryPauseProfile {
  softBreak: number;
  clause: number;
  sentence: number;
  expressiveSentence: number;
  ellipsis: number;
  paragraph: number;
}

const NATURAL_FAST_PAUSE_PROFILE: Readonly<BoundaryPauseProfile> = {
  softBreak: 0.04,
  clause: 0.12,
  sentence: 0.26,
  expressiveSentence: 0.34,
  ellipsis: 0.46,
  paragraph: 0.56,
};
const ELLIPSIS_ENDING_PATTERN = /(?:\.{3}|…)["'”’)\]]*$/u;
const EXPRESSIVE_ENDING_PATTERN = /[!?]+["'”’)\]]*$/u;
const SENTENCE_ENDING_PATTERN = /\.["'”’)\]]*$/u;
const CLAUSE_ENDING_PATTERN = /[,;:]["'”’)\]]*$/u;
const PCM_INITIAL_BUFFER_SECONDS = 0.2;
const PCM_STEADY_BUFFER_SECONDS = 0.1;
const PCM_SCHEDULE_LEAD_SECONDS = 0.03;

function getBoundaryPauseSeconds(previous: SpeechSegment, next: SpeechSegment): number {
  if (previous.pIdx !== next.pIdx) return NATURAL_FAST_PAUSE_PROFILE.paragraph;

  // A delimiter is a source boundary; an artificial max-length split is not.
  // This prevents a long sentence ending near a comma from sounding like it
  // was intentionally cut at a clause.
  if (previous.explicitBoundary) return NATURAL_FAST_PAUSE_PROFILE.sentence;
  if (previous.artificialSplit) return NATURAL_FAST_PAUSE_PROFILE.softBreak;

  const ending = previous.text.trimEnd();
  if (ELLIPSIS_ENDING_PATTERN.test(ending)) {
    return NATURAL_FAST_PAUSE_PROFILE.ellipsis;
  }
  if (EXPRESSIVE_ENDING_PATTERN.test(ending)) {
    return NATURAL_FAST_PAUSE_PROFILE.expressiveSentence;
  }
  if (SENTENCE_ENDING_PATTERN.test(ending)) {
    return NATURAL_FAST_PAUSE_PROFILE.sentence;
  }
  if (CLAUSE_ENDING_PATTERN.test(ending)) {
    return NATURAL_FAST_PAUSE_PROFILE.clause;
  }
  return NATURAL_FAST_PAUSE_PROFILE.softBreak;
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
    const candidateEnd = Math.min(chunk.text.length, cursor + maxCharacters);
    const candidate = chunk.text.slice(cursor, candidateEnd);
    // Never split a word/token. Prefer the last whitespace inside the window;
    // if one token exceeds the window, extend to its next boundary.
    const whitespace = [...candidate.matchAll(/\s/gu)].at(-1);
    let breakAt = whitespace ? cursor + whitespace.index! : -1;
    if (breakAt <= cursor) {
      const nextWhitespace = chunk.text.slice(candidateEnd).search(/\s/u);
      breakAt = nextWhitespace >= 0 ? candidateEnd + nextWhitespace : chunk.text.length;
    }

    const rawPhrase = chunk.text.slice(cursor, cursor + breakAt);
    const leadingWhitespace = rawPhrase.length - rawPhrase.trimStart().length;
    const phraseText = rawPhrase.trim();
    if (phraseText) {
      phrases.push({
        pIdx: chunk.pIdx,
        text: phraseText,
        startOffset: chunk.startOffset + cursor + leadingWhitespace,
        length: phraseText.length,
        artificialSplit: true,
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
      artificialSplit: true,
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

  // The chapter API uses an invisible separator when it groups source lines.
  // Split at that hard boundary before punctuation heuristics and preserve
  // offsets so word highlighting still maps to the rendered text.
  if (text.includes(INVISIBLE_SENTENCE_DELIMITER)) {
    const markedParts = text.split(INVISIBLE_SENTENCE_DELIMITER);
    const chunks: SentenceChunk[] = [];
    let partOffset = 0;
    markedParts.forEach((part, partIndex) => {
      const partChunks = splitParagraphIntoSentences(part, pIdx, options).map((chunk) => ({
        ...chunk,
        startOffset: chunk.startOffset + partOffset,
      }));
      if (partIndex < markedParts.length - 1 && partChunks.length > 0) {
        const lastChunk = partChunks[partChunks.length - 1];
        partChunks[partChunks.length - 1] = { ...lastChunk, explicitBoundary: true };
      }
      chunks.push(...partChunks);
      partOffset += part.length + INVISIBLE_SENTENCE_DELIMITER.length;
    });
    return chunks;
  }

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

/** Split only at the explicit DB delimiter; each part remains an atomic source unit. */
export function splitByDatabaseBoundaries(text: string, pIdx: number): SentenceChunk[] {
  if (!text || !text.trim()) return [];

  const parts = text.split(INVISIBLE_SENTENCE_DELIMITER);
  const chunks: SentenceChunk[] = [];
  let offset = 0;
  parts.forEach((part, index) => {
    const leadingSpaces = part.length - part.trimStart().length;
    const trimmed = part.trim();
    if (trimmed) {
      chunks.push({
        pIdx,
        text: trimmed,
        startOffset: offset + leadingSpaces,
        length: trimmed.length,
        explicitBoundary: index < parts.length - 1,
      });
    }
    offset += part.length + INVISIBLE_SENTENCE_DELIMITER.length;
  });
  return chunks;
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
  private readonly startLeadSeconds: number;
  private readonly prefetchAhead: number;
  private readonly prefetchByParagraph: boolean;
  private readonly prefetchParagraphsAhead: number;
  private readonly scheduledAudio = new Set<ScheduledAudio>();
  private activeSession: PlaybackSession | null = null;
  private nextSessionId = 1;

  constructor(options: GaplessTtsPlayerOptions) {
    this.engine = options.engine;
    this.synthesize = options.synthesize;
    this.stream = options.stream;
    this.startLeadSeconds = Math.max(0, options.startLeadSeconds ?? 0.03);
    this.prefetchAhead = Math.max(1, Math.floor(options.prefetchAhead ?? 2));
    this.prefetchByParagraph = options.prefetchByParagraph ?? false;
    this.prefetchParagraphsAhead = Math.max(1, Math.floor(options.prefetchParagraphsAhead ?? 2));
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
      const paragraphEnd = (index: number): number => {
        if (!this.prefetchByParagraph || index < 0 || index >= segments.length) return index + 1;
        const paragraphIndex = segments[index].pIdx;
        let end = index + 1;
        while (end < segments.length && segments[end].pIdx === paragraphIndex) end += 1;
        return end;
      };
      const ensurePreparedParagraph = (index: number): Promise<DecodedAudio[]> => {
        const end = paragraphEnd(index);
        return Promise.all(
          Array.from({ length: end - index }, (_, offset) => ensurePrepared(index + offset)!)
        );
      };
      const prefetchAfter = (index: number) => {
        if (this.prefetchByParagraph) {
          let nextIndex = paragraphEnd(index);
          for (let paragraphOffset = 0; paragraphOffset < this.prefetchParagraphsAhead; paragraphOffset += 1) {
            if (nextIndex >= segments.length) break;
            void ensurePreparedParagraph(nextIndex).catch(() => {});
            nextIndex = paragraphEnd(nextIndex);
          }
          return;
        }
        for (let offset = 1; offset <= this.prefetchAhead; offset += 1) {
          ensurePrepared(index + offset);
        }
      };

      const firstParagraph = await ensurePreparedParagraph(0);
      const firstAudio = firstParagraph[0];
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
      const paragraphEnd = (index: number): number => {
        if (!this.prefetchByParagraph || index < 0 || index >= segments.length) return index + 1;
        const paragraphIndex = segments[index].pIdx;
        let end = index + 1;
        while (end < segments.length && segments[end].pIdx === paragraphIndex) end += 1;
        return end;
      };
      const ensureStreamParagraph = (index: number): Promise<PrefetchedPcmStream[]> => {
        const end = paragraphEnd(index);
        return Promise.all(
          Array.from({ length: end - index }, (_, offset) => ensureStream(index + offset)!)
        );
      };
      const prefetchAfter = (index: number) => {
        if (this.prefetchByParagraph) {
          let nextIndex = paragraphEnd(index);
          for (let paragraphOffset = 0; paragraphOffset < this.prefetchParagraphsAhead; paragraphOffset += 1) {
            if (nextIndex >= segments.length) break;
            void ensureStreamParagraph(nextIndex).catch(() => {});
            nextIndex = paragraphEnd(nextIndex);
          }
          return;
        }
        for (let offset = 1; offset <= this.prefetchAhead; offset += 1) {
          ensureStream(index + offset);
        }
      };

      if (this.prefetchByParagraph) {
        // The first paragraph is a startup barrier: every sentence must be
        // ready before playback begins so the first paragraph cannot stall.
        await ensureStreamParagraph(0);
      } else {
        ensureStream(0);
      }
      prefetchAfter(0);

      for (let index = 0; index < segments.length; index += 1) {
        if (!this.engine.beginPcmStream) return;

        const segment = segments[index];
        const audioStream = await ensureStream(index)!;
        if (!this.isActive(session)) return;
        preparedStreams.delete(index);
        prefetchAfter(index);

        if (audioStream.byteLength === 0) {
          throw new Error('TTS streaming returned no audio');
        }

        const startAt = previousPlayback
          ? previousPlayback.endAt + getBoundaryPauseSeconds(segments[index - 1], segment)
          : this.engine.now() + this.startLeadSeconds;
        const playback = this.engine.beginPcmStream(
          audioStream.sampleRate,
          audioStream.channels,
          startAt
        );
        this.scheduledAudio.add(playback);
        audioStream.chunks.forEach((chunk) => playback.append(chunk));
        playback.finish();
        hasScheduledAudio = true;

        this.queueWordCuesForDuration(
          session,
          index,
          segment,
          playback.duration,
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
    const reader = audioStream.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    const cancelReader = () => {
      void reader.cancel().catch(() => {});
    };
    session.controller.signal.addEventListener('abort', cancelReader, { once: true });

    try {
      if (session.controller.signal.aborted) {
        cancelReader();
      }
      while (!session.controller.signal.aborted) {
        const result = await reader.read();
        if (result.done) break;
        if (!result.value || result.value.byteLength === 0) continue;
        chunks.push(result.value);
        byteLength += result.value.byteLength;
      }
    } finally {
      session.controller.signal.removeEventListener('abort', cancelReader);
      reader.releaseLock();
    }

    return {
      sampleRate: audioStream.sampleRate,
      channels: audioStream.channels,
      chunks,
      byteLength,
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

  constructor(
    private readonly context: AudioContext,
    playbackRate: number = 1.0,
    private readonly preservePitch: boolean = false
  ) {
    this.playbackRate = Math.max(0.25, Math.min(playbackRate, 4.0));
  }

  public now(): number {
    return this.context.currentTime;
  }

  public async decode(blob: Blob): Promise<DecodedAudio> {
    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
    if (this.preservePitch && this.playbackRate !== 1) {
      // Load SoundTouch lazily so browsers without AudioWorklet (and test
      // environments such as jsdom) can still use the normal server pipeline.
      const { processOffline } = await import('@soundtouchjs/audio-worklet');
      const processed = await processOffline({
        input: buffer,
        processorUrl: soundTouchProcessorUrl,
        playbackRate: this.playbackRate,
        pitch: 1,
      });
      return { duration: processed.duration, value: processed };
    }

    return {
      duration: buffer.duration,
      value: buffer,
    };
  }

  public schedule(audio: DecodedAudio, startAt: number): ScheduledAudio {
    const source = this.context.createBufferSource();
    source.buffer = audio.value as AudioBuffer;
    if (this.playbackRate !== 1.0 && !this.preservePitch) {
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

    const scaledDuration = this.preservePitch ? audio.duration : audio.duration / this.playbackRate;
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
