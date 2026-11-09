import { useRef } from 'react';

import {
	disposeAudioElement,
	drainEdgePrefetchQueue,
	getOrCreateAbortController,
	isChunkEmpty,
	prunePrefetchCache,
	startFetchedEdgeAudio,
	synthesizeOrGetCachedChunk,
	type BrowserEdgeOptions,
} from './edgePlaybackHelpers';

import type { EdgeSpeechWithBoundaries } from '@/services/edgeTtsService';

const PREFETCH_CONCURRENCY_LIMIT = 2;
const PREFETCH_WINDOW_SIZE = 5;

export function useBrowserEdgePlayback(options: BrowserEdgeOptions) {
	const { chunks, edgeVoiceUri, activeDomain, speechRateRef } = options;
	const edgeAudioRef = useRef<HTMLAudioElement | null>(null);
	const edgeAudioUrlRef = useRef<string | null>(null);
	const edgeBoundaryFrameRef = useRef<number | null>(null);
	const edgeRequestAbortRef = useRef<AbortController | null>(null);
	const edgePrefetchCacheRef = useRef<Map<number, Promise<EdgeSpeechWithBoundaries>>>(new Map());
	const edgePrefetchQueueRef = useRef<number[]>([]);
	const edgeActivePrefetchCountRef = useRef(0);

	const stopEdgeBoundaryTracking = () => {
		if (edgeBoundaryFrameRef.current !== null) {
			window.cancelAnimationFrame(edgeBoundaryFrameRef.current);
			edgeBoundaryFrameRef.current = null;
		}
	};

	const releaseEdgeAudio = () => {
		stopEdgeBoundaryTracking();
		disposeAudioElement(edgeAudioRef, edgeAudioUrlRef);
	};

	const prefetchEdgeChunk = (index: number): Promise<EdgeSpeechWithBoundaries> =>
		synthesizeOrGetCachedChunk(
			index,
			chunks,
			edgePrefetchCacheRef.current,
			edgeRequestAbortRef,
			speechRateRef.current ?? 1.8,
			edgeVoiceUri,
			activeDomain?.url
		);

	const processPrefetchQueue = () => {
		drainEdgePrefetchQueue(
			chunks,
			edgePrefetchCacheRef.current,
			edgePrefetchQueueRef.current,
			edgeActivePrefetchCountRef,
			PREFETCH_CONCURRENCY_LIMIT,
			prefetchEdgeChunk,
			processPrefetchQueue
		);
	};

	const queuePrefetchWindow = (fromIndex: number, count: number = PREFETCH_WINDOW_SIZE) => {
		for (let i = 1; i <= count; i++) {
			const targetIdx = fromIndex + i;
			if (targetIdx < chunks.length && !edgePrefetchCacheRef.current.has(targetIdx) && !edgePrefetchQueueRef.current.includes(targetIdx))
				edgePrefetchQueueRef.current.push(targetIdx);
		}
		processPrefetchQueue();
	};

	const playChunkViaEdge = (index: number, sessionId: number, startOffset: number = 0) => {
		if (!options.isPlayingRef.current || options.playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			options.clearResumePosition();
			options.stopReading(true);
			return;
		}

		options.currentChunkIdxRef.current = index;
		options.setCurrentChunkIndex(index);

		if (isChunkEmpty(chunks[index])) {
			playChunkViaEdge(index + 1, sessionId, 0);
			return;
		}

		releaseEdgeAudio();
		edgeRequestAbortRef.current = getOrCreateAbortController(edgeRequestAbortRef.current);

		let fetchPromise = edgePrefetchCacheRef.current.get(index);
		if (!fetchPromise) {
			edgeActivePrefetchCountRef.current += 1;
			fetchPromise = prefetchEdgeChunk(index).finally(() => {
				edgeActivePrefetchCountRef.current = Math.max(0, edgeActivePrefetchCountRef.current - 1);
				processPrefetchQueue();
			});
		}

		prunePrefetchCache(edgePrefetchCacheRef.current, index - 1);
		queuePrefetchWindow(index, PREFETCH_WINDOW_SIZE);

		fetchPromise
			.then(({ audio: blob, wordBoundaries }) => {
				startFetchedEdgeAudio({
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
				});
			})
			.catch((err) => {
				if (options.playSessionIdRef.current !== sessionId || !options.isPlayingRef.current) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.warn('[Edge TTS] Synthesis error, fallback to browser voice:', err);
				options.playChunkViaBrowser(index, 0, sessionId);
			});
	};

	const stop = (clearCache = false) => {
		releaseEdgeAudio();
		edgePrefetchQueueRef.current = [];
		if (!clearCache) return;
		edgeRequestAbortRef.current?.abort();
		edgeRequestAbortRef.current = null;
		edgePrefetchCacheRef.current.clear();
	};
	return {
		play: playChunkViaEdge,
		stop,
		hasAudio: () => edgeAudioRef.current !== null,
		pause: () => edgeAudioRef.current?.pause(),
		resume: () => edgeAudioRef.current?.play() ?? Promise.resolve(),
		recoverIfPaused: () => {
			if (edgeAudioRef.current?.paused) void edgeAudioRef.current.play().catch(() => {});
		},
	};
}
