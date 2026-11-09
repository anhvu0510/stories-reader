import {
	createPlaybackSession,
	findParagraphEnd,
	prefetchItemsAhead,
	queueWordCuesForAudio,
	readPcmAudioStream,
	schedulePcmStreamChunk,
	startSessionWordTracking,
	type PlaybackSession,
	type PrefetchedPcmStream,
} from './gapless-tts/gaplessSessionHelpers';
import {
	buildSpeechSegments,
	buildWordTimeline,
	getBoundaryPauseSeconds,
	INVISIBLE_SENTENCE_DELIMITER,
	splitByDatabaseBoundaries,
	splitParagraphIntoSentences,
	type SentenceChunk,
	type SentenceSplitOptions,
	type SpeechSegment,
	type SpeechSegmentOptions,
	type WordCue,
} from './gapless-tts/sentenceSplitter';
import {
	WebAudioPlaybackEngine,
	type AudioPlaybackEngine,
	type DecodedAudio,
	type PcmAudioStream,
	type PcmStreamPlayback,
	type ScheduledAudio,
} from './gapless-tts/webAudioPlaybackEngine';

export {
	buildSpeechSegments,
	buildWordTimeline,
	INVISIBLE_SENTENCE_DELIMITER,
	splitByDatabaseBoundaries,
	splitParagraphIntoSentences,
	WebAudioPlaybackEngine,
	type AudioPlaybackEngine,
	type DecodedAudio,
	type PcmAudioStream,
	type PcmStreamPlayback,
	type ScheduledAudio,
	type SentenceChunk,
	type SentenceSplitOptions,
	type SpeechSegment,
	type SpeechSegmentOptions,
	type WordCue,
};

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

		const session = createPlaybackSession(this.nextSessionId++);
		this.activeSession = session;

		const supportsStreaming = Boolean(this.stream && this.engine.beginPcmStream);
		void this.engine.resume().then(
			() => (supportsStreaming ? this.runStreaming(session, segments, callbacks) : this.run(session, segments, callbacks)),
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

	private async playSegmentTransition(
		session: PlaybackSession,
		currentPlayback: ScheduledAudio,
		nextAudio: DecodedAudio,
		index: number,
		segments: SpeechSegment[],
		callbacks: GaplessPlaybackCallbacks
	): Promise<ScheduledAudio | null> {
		const nextStartAt = Math.max(
			currentPlayback.endAt + getBoundaryPauseSeconds(segments[index - 1], segments[index]),
			this.engine.now() + this.startLeadSeconds
		);
		const nextPlayback = this.scheduleAudio(nextAudio, nextStartAt);
		queueWordCuesForAudio(session, index, segments[index], nextAudio, nextStartAt, this.engine.playbackRate);

		await Promise.race([currentPlayback.ended, session.cancelled]);
		this.scheduledAudio.delete(currentPlayback);
		if (!this.isActive(session)) return null;

		callbacks.onSegmentStart?.(index, segments[index]);
		return nextPlayback;
	}

	private finishPlayback(session: PlaybackSession, callbacks: GaplessPlaybackCallbacks): void {
		session.stopWatchingTime?.();
		this.activeSession = null;
		callbacks.onFinished?.();
	}

	private async run(session: PlaybackSession, segments: SpeechSegment[], callbacks: GaplessPlaybackCallbacks): Promise<void> {
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
			const ensurePreparedParagraph = (index: number): Promise<DecodedAudio[]> => {
				const end = findParagraphEnd(segments, index, this.prefetchByParagraph);
				return Promise.all(Array.from({ length: end - index }, (_, offset) => ensurePrepared(index + offset)!));
			};
			const prefetchAfter = (index: number) => {
				prefetchItemsAhead(
					index,
					segments,
					this.prefetchByParagraph,
					this.prefetchParagraphsAhead,
					this.prefetchAhead,
					ensurePrepared,
					ensurePreparedParagraph
				);
			};

			const firstParagraph = await ensurePreparedParagraph(0);
			const firstAudio = firstParagraph[0];
			if (!this.isActive(session)) return;

			const firstStartAt = this.engine.now() + this.startLeadSeconds;
			let currentPlayback = this.scheduleAudio(firstAudio, firstStartAt);
			preparedAudio.delete(0);
			prefetchAfter(0);
			queueWordCuesForAudio(session, 0, segments[0], firstAudio, firstStartAt, this.engine.playbackRate);
			startSessionWordTracking(session, this.engine, (s) => this.isActive(s), callbacks);
			callbacks.onSegmentStart?.(0, segments[0]);

			for (let index = 1; index < segments.length; index += 1) {
				const nextAudio = await ensurePrepared(index)!;
				if (!this.isActive(session)) return;
				preparedAudio.delete(index);

				const nextPlayback = await this.playSegmentTransition(session, currentPlayback, nextAudio, index, segments, callbacks);
				if (!nextPlayback) return;
				currentPlayback = nextPlayback;
				prefetchAfter(index);
			}

			await Promise.race([currentPlayback.ended, session.cancelled]);
			this.scheduledAudio.delete(currentPlayback);
			if (!this.isActive(session)) return;

			this.finishPlayback(session, callbacks);
		} catch (error: unknown) {
			if (!this.isActive(session)) return;
			this.cancelActiveSession();
			callbacks.onError?.(error);
		}
	}

	private async handleStreamingError(
		error: unknown,
		hasScheduledAudio: boolean,
		session: PlaybackSession,
		segments: SpeechSegment[],
		callbacks: GaplessPlaybackCallbacks
	): Promise<void> {
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

	private async runStreaming(session: PlaybackSession, segments: SpeechSegment[], callbacks: GaplessPlaybackCallbacks): Promise<void> {
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
			const ensureStreamParagraph = (index: number): Promise<PrefetchedPcmStream[]> => {
				const end = findParagraphEnd(segments, index, this.prefetchByParagraph);
				return Promise.all(Array.from({ length: end - index }, (_, offset) => ensureStream(index + offset)!));
			};
			const prefetchAfter = (index: number) => {
				prefetchItemsAhead(
					index,
					segments,
					this.prefetchByParagraph,
					this.prefetchParagraphsAhead,
					this.prefetchAhead,
					ensureStream,
					ensureStreamParagraph
				);
			};

			if (this.prefetchByParagraph) {
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

				const playback = schedulePcmStreamChunk({
					engine: this.engine,
					startLeadSeconds: this.startLeadSeconds,
					scheduledAudio: this.scheduledAudio,
					session,
					audioStream,
					segment,
					index,
					segments,
					previousPlayback,
					isActive: (s) => this.isActive(s),
					callbacks,
				});
				if (!playback) return;
				hasScheduledAudio = true;
				previousPlayback = playback;
			}

			if (!previousPlayback) return;
			await Promise.race([previousPlayback.ended, session.cancelled]);
			if (!this.isActive(session)) return;

			this.finishPlayback(session, callbacks);
		} catch (error: unknown) {
			await this.handleStreamingError(error, hasScheduledAudio, session, segments, callbacks);
		}
	}

	private async prepareStreamingSegment(session: PlaybackSession, segment: SpeechSegment): Promise<PrefetchedPcmStream> {
		if (!this.stream) {
			throw new Error('TTS streaming is unavailable');
		}
		const audioStream = await this.stream(segment, session.controller.signal);
		return readPcmAudioStream(audioStream, session.controller.signal);
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
