import { buildWordTimeline, getBoundaryPauseSeconds, type SpeechSegment, type WordCue } from './sentenceSplitter';

import type { GaplessPlaybackCallbacks } from '../gaplessTtsPlayer';
import type { AudioPlaybackEngine, DecodedAudio, PcmAudioStream, PcmStreamPlayback, ScheduledAudio } from './webAudioPlaybackEngine';

export interface PlaybackSession {
	id: number;
	controller: AbortController;
	cancelled: Promise<void>;
	cancel: () => void;
	scheduledWordCues: Array<WordCue & { absoluteStart: number; segmentIndex: number; segment: SpeechSegment }>;
	nextWordCueIndex: number;
	stopWatchingTime?: () => void;
}

export interface PrefetchedPcmStream {
	sampleRate: number;
	channels: number;
	chunks: Uint8Array[];
	byteLength: number;
}

export function createPlaybackSession(id: number): PlaybackSession {
	let cancelSession = () => {};
	return {
		id,
		controller: new AbortController(),
		cancelled: new Promise<void>((resolve) => {
			cancelSession = resolve;
		}),
		cancel: () => cancelSession(),
		scheduledWordCues: [],
		nextWordCueIndex: 0,
	};
}

export function findParagraphEnd(segments: SpeechSegment[], index: number, prefetchByParagraph: boolean): number {
	if (!prefetchByParagraph || index < 0 || index >= segments.length) return index + 1;
	const paragraphIndex = segments[index].pIdx;
	let end = index + 1;
	while (end < segments.length && segments[end].pIdx === paragraphIndex) end += 1;
	return end;
}

export function prefetchItemsAhead<T>(
	index: number,
	segments: SpeechSegment[],
	prefetchByParagraph: boolean,
	prefetchParagraphsAhead: number,
	prefetchAhead: number,
	ensureItem: (idx: number) => Promise<T> | undefined,
	ensureParagraph: (idx: number) => Promise<T[]>
): void {
	if (prefetchByParagraph) {
		let nextIndex = findParagraphEnd(segments, index, true);
		for (let offset = 0; offset < prefetchParagraphsAhead; offset += 1) {
			if (nextIndex >= segments.length) break;
			void ensureParagraph(nextIndex).catch(() => {});
			nextIndex = findParagraphEnd(segments, nextIndex, true);
		}
		return;
	}
	for (let offset = 1; offset <= prefetchAhead; offset += 1) {
		ensureItem(index + offset);
	}
}

export async function readPcmAudioStream(audioStream: PcmAudioStream, signal: AbortSignal): Promise<PrefetchedPcmStream> {
	const reader = audioStream.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	const cancelReader = () => {
		void reader.cancel().catch(() => {});
	};
	signal.addEventListener('abort', cancelReader, { once: true });

	try {
		if (signal.aborted) {
			cancelReader();
		}
		while (!signal.aborted) {
			const result = await reader.read();
			if (result.done) break;
			if (!result.value || result.value.byteLength === 0) continue;
			chunks.push(result.value);
			byteLength += result.value.byteLength;
		}
	} finally {
		signal.removeEventListener('abort', cancelReader);
		reader.releaseLock();
	}

	return {
		sampleRate: audioStream.sampleRate,
		channels: audioStream.channels,
		chunks,
		byteLength,
	};
}

export function queueWordCuesForDuration(
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

export function queueWordCuesForAudio(
	session: PlaybackSession,
	segmentIndex: number,
	segment: SpeechSegment,
	audio: DecodedAudio,
	startAt: number,
	playbackRate: number | undefined
): void {
	const rate = playbackRate && playbackRate > 0 ? playbackRate : 1.0;
	const effectiveDuration = audio.duration / rate;
	queueWordCuesForDuration(session, segmentIndex, segment, effectiveDuration, startAt);
}

export function startSessionWordTracking(
	session: PlaybackSession,
	engine: AudioPlaybackEngine,
	isActive: (s: PlaybackSession) => boolean,
	callbacks: GaplessPlaybackCallbacks
): void {
	if (!callbacks.onWordBoundary || !engine.watchTime || session.stopWatchingTime) return;

	session.stopWatchingTime = engine.watchTime((currentTime) => {
		if (!isActive(session)) return;

		while (session.nextWordCueIndex < session.scheduledWordCues.length) {
			const cue = session.scheduledWordCues[session.nextWordCueIndex];
			if (cue.absoluteStart > currentTime) break;

			callbacks.onWordBoundary?.(cue.segmentIndex, cue.segment, cue);
			session.nextWordCueIndex += 1;
		}
	});
}

export function schedulePcmStreamChunk(params: {
	engine: AudioPlaybackEngine;
	startLeadSeconds: number;
	scheduledAudio: Set<ScheduledAudio>;
	session: PlaybackSession;
	audioStream: PrefetchedPcmStream;
	segment: SpeechSegment;
	index: number;
	segments: SpeechSegment[];
	previousPlayback: PcmStreamPlayback | null;
	isActive: (s: PlaybackSession) => boolean;
	callbacks: GaplessPlaybackCallbacks;
}): PcmStreamPlayback | null {
	const {
		engine,
		startLeadSeconds,
		scheduledAudio,
		session,
		audioStream,
		segment,
		index,
		segments,
		previousPlayback,
		isActive,
		callbacks,
	} = params;
	if (!engine.beginPcmStream) return null;

	const startAt = previousPlayback
		? previousPlayback.endAt + getBoundaryPauseSeconds(segments[index - 1], segment)
		: engine.now() + startLeadSeconds;
	const playback = engine.beginPcmStream(audioStream.sampleRate, audioStream.channels, startAt);
	scheduledAudio.add(playback);
	audioStream.chunks.forEach((chunk) => playback.append(chunk));
	playback.finish();

	queueWordCuesForDuration(session, index, segment, playback.duration, playback.startAt);
	startSessionWordTracking(session, engine, isActive, callbacks);

	if (previousPlayback) {
		const priorPlayback = previousPlayback;
		void Promise.race([priorPlayback.ended, session.cancelled]).then(() => {
			if (isActive(session)) {
				callbacks.onSegmentStart?.(index, segment);
			}
		});
	} else {
		callbacks.onSegmentStart?.(index, segment);
	}

	void playback.ended.then(() => scheduledAudio.delete(playback));
	return playback;
}
