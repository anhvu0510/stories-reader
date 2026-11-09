import { EdgeTTSService, type EdgeSpeechWithBoundaries } from '@/services/edgeTtsService';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import type { SentenceChunk } from '@/services/gaplessTtsPlayer';
import type { RefObject } from 'react';

export function initialBoundary(words: EdgeSpeechWithBoundaries['wordBoundaries'], offset: number): { time: number; index: number } {
	if (offset <= 0 || words.length === 0) return { time: 0, index: 0 };
	const index = words.findIndex((word) => word.charIndex >= offset || word.charIndex + word.charLength > offset);
	if (index < 0) return { time: 0, index: 0 };
	return { time: words[index].startSeconds, index };
}

export function getOrCreateAbortController(current: AbortController | null): AbortController {
	if (!current || current.signal.aborted) {
		return new AbortController();
	}
	return current;
}

export function prunePrefetchCache(cache: Map<number, unknown>, minIndex: number): void {
	for (const k of cache.keys()) {
		if (k < minIndex) cache.delete(k);
	}
}

export function isChunkEmpty(chunk: SentenceChunk | undefined): boolean {
	return !chunk || !chunk.text.trim();
}

export function getSpeechRate(fallback: number): number {
	return useReaderConfigStore.getState().speechRate ?? fallback;
}

export function disposeAudioElement(edgeAudioRef: RefObject<HTMLAudioElement | null>, edgeAudioUrlRef: RefObject<string | null>): void {
	const audio = edgeAudioRef.current;
	if (audio) {
		audio.onplay = null;
		audio.onpause = null;
		audio.ontimeupdate = null;
		audio.onended = null;
		audio.onerror = null;
		audio.pause();
		edgeAudioRef.current = null;
	}
	if (edgeAudioUrlRef.current) {
		URL.revokeObjectURL(edgeAudioUrlRef.current);
		edgeAudioUrlRef.current = null;
	}
}

export function synthesizeOrGetCachedChunk(
	index: number,
	chunks: SentenceChunk[],
	cache: Map<number, Promise<EdgeSpeechWithBoundaries>>,
	abortRef: RefObject<AbortController | null>,
	fallbackRate: number,
	edgeVoiceUri: string,
	domainUrl: string | undefined
): Promise<EdgeSpeechWithBoundaries> {
	if (index < 0 || index >= chunks.length) return Promise.reject(new Error('Index out of range'));
	const existing = cache.get(index);
	if (existing) return existing;

	const chunk = chunks[index];
	if (isChunkEmpty(chunk)) return Promise.reject(new Error('Empty chunk text'));

	abortRef.current = getOrCreateAbortController(abortRef.current);
	const currentSpeechRate = getSpeechRate(fallbackRate);
	const promise = EdgeTTSService.synthesizeSpeechWithBoundaries(
		chunk.text,
		edgeVoiceUri,
		currentSpeechRate,
		domainUrl,
		abortRef.current.signal
	).catch((err) => {
		cache.delete(index);
		throw err;
	});

	cache.set(index, promise);
	return promise;
}

export function drainEdgePrefetchQueue(
	chunks: SentenceChunk[],
	cache: Map<number, Promise<EdgeSpeechWithBoundaries>>,
	queue: number[],
	activeCountRef: RefObject<number>,
	limit: number,
	prefetchChunk: (idx: number) => Promise<EdgeSpeechWithBoundaries>,
	onDrained: () => void
): void {
	while (activeCountRef.current < limit && queue.length > 0) {
		const nextIdx = queue.shift();
		if (nextIdx === undefined) break;
		if (cache.has(nextIdx) || nextIdx < 0 || nextIdx >= chunks.length) continue;

		const chunk = chunks[nextIdx];
		if (!chunk || !chunk.text.trim()) continue;

		activeCountRef.current += 1;
		prefetchChunk(nextIdx)
			.finally(() => {
				activeCountRef.current = Math.max(0, activeCountRef.current - 1);
				onDrained();
			})
			.catch(() => {});
	}
}

export interface BrowserEdgeOptions {
	chunks: SentenceChunk[];
	edgeVoiceUri: string;
	activeDomain: { url: string } | null | undefined;
	speechRateRef: RefObject<number>;
	isPlayingRef: RefObject<boolean>;
	playSessionIdRef: RefObject<number>;
	currentChunkIdxRef: RefObject<number>;
	setCurrentChunkIndex: (index: number) => void;
	setIsLoading: (loading: boolean) => void;
	setIsPlaying: (playing: boolean) => void;
	clearResumePosition: () => void;
	stopReading: (clearSaved?: boolean) => void;
	updateWordHighlight: (index: number, charIndex: number, length: number) => void;
	playChunkViaBrowser: (index: number, offset: number, sessionId: number) => void;
}

export interface StartFetchedEdgeAudioParams {
	blob: Blob;
	wordBoundaries: EdgeSpeechWithBoundaries['wordBoundaries'];
	index: number;
	sessionId: number;
	startOffset: number;
	options: BrowserEdgeOptions;
	edgeAudioRef: RefObject<HTMLAudioElement | null>;
	edgeAudioUrlRef: RefObject<string | null>;
	edgeBoundaryFrameRef: RefObject<number | null>;
	playChunkViaEdge: (index: number, sessionId: number, startOffset?: number) => void;
	stopEdgeBoundaryTracking: () => void;
	releaseEdgeAudio: () => void;
}

export function startFetchedEdgeAudio(params: StartFetchedEdgeAudioParams): void {
	const {
		blob,
		wordBoundaries,
		index,
		sessionId,
		startOffset,
		options,
		edgeAudioRef,
		edgeAudioUrlRef,
		edgeBoundaryFrameRef,
		playChunkViaEdge,
		stopEdgeBoundaryTracking,
		releaseEdgeAudio,
	} = params;
	const {
		chunks,
		isPlayingRef,
		playSessionIdRef,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		updateWordHighlight,
		playChunkViaBrowser,
	} = options;
	const chunksLength = chunks.length;

	if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;

	const initial = initialBoundary(wordBoundaries, startOffset);
	const initialSeekTime = initial.time;
	const initialBoundaryIndex = initial.index;

	const audioUrl = URL.createObjectURL(blob);
	const audio = new Audio(audioUrl);
	edgeAudioRef.current = audio;
	edgeAudioUrlRef.current = audioUrl;

	let initialSeekApplied = false;
	const applyInitialSeek = () => {
		if (initialSeekApplied || initialSeekTime <= 0) return;
		try {
			audio.currentTime = initialSeekTime;
			initialSeekApplied = true;
		} catch {
			// intentionally empty — currentTime assignment may fail on some browsers
		}
	};

	audio.addEventListener?.('loadedmetadata', applyInitialSeek, { once: true });
	audio.addEventListener?.('canplay', applyInitialSeek, { once: true });
	applyInitialSeek();

	let nextBoundaryIndex = initialBoundaryIndex;
	const syncWordBoundary = () => {
		if (edgeAudioRef.current !== audio || !isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		let activeBoundary = null as (typeof wordBoundaries)[number] | null;
		while (nextBoundaryIndex < wordBoundaries.length && wordBoundaries[nextBoundaryIndex].startSeconds <= audio.currentTime) {
			activeBoundary = wordBoundaries[nextBoundaryIndex];
			nextBoundaryIndex += 1;
		}
		if (activeBoundary) updateWordHighlight(index, activeBoundary.charIndex, activeBoundary.charLength);
	};

	const startBoundaryTracking = () => {
		stopEdgeBoundaryTracking();
		const tick = () => {
			syncWordBoundary();
			if (edgeAudioRef.current === audio && !audio.paused && !audio.ended && playSessionIdRef.current === sessionId) {
				edgeBoundaryFrameRef.current = window.requestAnimationFrame(tick);
			} else {
				edgeBoundaryFrameRef.current = null;
			}
		};
		edgeBoundaryFrameRef.current = window.requestAnimationFrame(tick);
	};

	audio.ontimeupdate = syncWordBoundary;
	audio.onplay = () => {
		applyInitialSeek();
		if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
			setIsLoading(false);
			setIsPlaying(true);
		}
		const startingBoundary = (initialBoundaryIndex < wordBoundaries.length && wordBoundaries[initialBoundaryIndex]) || wordBoundaries[0];
		if (initialSeekTime > 0 && startingBoundary) updateWordHighlight(index, startingBoundary.charIndex, startingBoundary.charLength);
		startBoundaryTracking();
	};
	audio.onpause = stopEdgeBoundaryTracking;
	audio.onended = () => {
		stopEdgeBoundaryTracking();
		if (edgeAudioRef.current === audio) edgeAudioRef.current = null;
		if (edgeAudioUrlRef.current === audioUrl) edgeAudioUrlRef.current = null;
		URL.revokeObjectURL(audioUrl);
		if (index >= chunksLength - 1) clearResumePosition();
		if (isPlayingRef.current && playSessionIdRef.current === sessionId) playChunkViaEdge(index + 1, sessionId, 0);
	};
	audio.onerror = (err) => {
		if (playSessionIdRef.current !== sessionId) return;
		stopEdgeBoundaryTracking();
		if (edgeAudioRef.current === audio) edgeAudioRef.current = null;
		if (edgeAudioUrlRef.current === audioUrl) edgeAudioUrlRef.current = null;
		URL.revokeObjectURL(audioUrl);
		console.warn('[Edge TTS] Playback error, fallback to browser voice:', err);
		playChunkViaBrowser(index, 0, sessionId);
	};

	const playPromise = audio.play();
	if (playPromise && typeof playPromise.catch === 'function') {
		playPromise.catch((err) => {
			if (playSessionIdRef.current !== sessionId) return;
			releaseEdgeAudio();
			console.warn('[Edge TTS] Audio play error:', err);
			playChunkViaBrowser(index, 0, sessionId);
		});
	}
}
