import { useRef, type RefObject } from 'react';
import { EdgeTTSService, type EdgeSpeechWithBoundaries } from '@/services/edgeTtsService';
import type { SentenceChunk } from '@/services/gaplessTtsPlayer';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

interface BrowserEdgeOptions {
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

export function useBrowserEdgePlayback(options: BrowserEdgeOptions) {
	const {
		chunks,
		edgeVoiceUri,
		activeDomain,
		speechRateRef,
		isPlayingRef,
		playSessionIdRef,
		currentChunkIdxRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		stopReading,
		updateWordHighlight,
		playChunkViaBrowser
	} = options;
	const edgeAudioRef = useRef<HTMLAudioElement | null>(null);
	const edgeAudioUrlRef = useRef<string | null>(null);
	const edgeBoundaryFrameRef = useRef<number | null>(null);
	const edgeRequestAbortRef = useRef<AbortController | null>(null);

	const stopEdgeBoundaryTracking = () => {
		if (edgeBoundaryFrameRef.current !== null) {
			window.cancelAnimationFrame(edgeBoundaryFrameRef.current);
			edgeBoundaryFrameRef.current = null;
		}
	};

	const releaseEdgeAudio = () => {
		stopEdgeBoundaryTracking();
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
	};

	const edgePrefetchCacheRef = useRef<Map<number, Promise<EdgeSpeechWithBoundaries>>>(new Map());
	const edgePrefetchQueueRef = useRef<number[]>([]);
	const edgeActivePrefetchCountRef = useRef(0);
	const PREFETCH_CONCURRENCY_LIMIT = 2;
	const PREFETCH_WINDOW_SIZE = 5;

	const prefetchEdgeChunk = (index: number): Promise<EdgeSpeechWithBoundaries> => {
		if (index < 0 || index >= chunks.length) {
			return Promise.reject(new Error('Index out of range'));
		}
		const existing = edgePrefetchCacheRef.current.get(index);
		if (existing) return existing;

		const chunk = chunks[index];
		if (!chunk || !chunk.text.trim()) {
			return Promise.reject(new Error('Empty chunk text'));
		}

		if (!edgeRequestAbortRef.current || edgeRequestAbortRef.current.signal.aborted) {
			edgeRequestAbortRef.current = new AbortController();
		}

		const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;
		const promise = EdgeTTSService.synthesizeSpeechWithBoundaries(chunk.text, edgeVoiceUri, currentSpeechRate, activeDomain?.url, edgeRequestAbortRef.current.signal).catch((err) => {
			edgePrefetchCacheRef.current.delete(index);
			throw err;
		});

		edgePrefetchCacheRef.current.set(index, promise);
		return promise;
	};

	const processPrefetchQueue = () => {
		while (edgeActivePrefetchCountRef.current < PREFETCH_CONCURRENCY_LIMIT && edgePrefetchQueueRef.current.length > 0) {
			const nextIdx = edgePrefetchQueueRef.current.shift();
			if (nextIdx === undefined) break;
			if (edgePrefetchCacheRef.current.has(nextIdx)) continue;
			if (nextIdx < 0 || nextIdx >= chunks.length) continue;

			const chunk = chunks[nextIdx];
			if (!chunk || !chunk.text.trim()) continue;

			edgeActivePrefetchCountRef.current += 1;
			prefetchEdgeChunk(nextIdx)
				.finally(() => {
					edgeActivePrefetchCountRef.current = Math.max(0, edgeActivePrefetchCountRef.current - 1);
					processPrefetchQueue();
				})
				.catch(() => {});
		}
	};

	const queuePrefetchWindow = (fromIndex: number, count: number = PREFETCH_WINDOW_SIZE) => {
		for (let i = 1; i <= count; i++) {
			const targetIdx = fromIndex + i;
			if (targetIdx < chunks.length && !edgePrefetchCacheRef.current.has(targetIdx) && !edgePrefetchQueueRef.current.includes(targetIdx)) edgePrefetchQueueRef.current.push(targetIdx);
		}
		processPrefetchQueue();
	};

	const playChunkViaEdge = (index: number, sessionId: number, startOffset: number = 0) => {
		if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			clearResumePosition();
			stopReading(true);
			return;
		}

		currentChunkIdxRef.current = index;
		setCurrentChunkIndex(index);

		const chunk = chunks[index];
		if (!chunk || !chunk.text.trim()) {
			playChunkViaEdge(index + 1, sessionId, 0);
			return;
		}

		releaseEdgeAudio();

		if (!edgeRequestAbortRef.current || edgeRequestAbortRef.current.signal.aborted) {
			edgeRequestAbortRef.current = new AbortController();
		}

		// Ensure current chunk is in cache (or in flight)
		let fetchPromise = edgePrefetchCacheRef.current.get(index);
		if (!fetchPromise) {
			edgeActivePrefetchCountRef.current += 1;
			fetchPromise = prefetchEdgeChunk(index).finally(() => {
				edgeActivePrefetchCountRef.current = Math.max(0, edgeActivePrefetchCountRef.current - 1);
				processPrefetchQueue();
			});
		}

		// Clean old entries (keep chunk index - 1 and forward)
		for (const k of edgePrefetchCacheRef.current.keys()) {
			if (k < index - 1) edgePrefetchCacheRef.current.delete(k);
		}

		// Trigger sliding window prefetch for upcoming 5 chunks
		queuePrefetchWindow(index, PREFETCH_WINDOW_SIZE);

		fetchPromise
			.then(({ audio: blob, wordBoundaries }) => {
				if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;

				// Calculate initial seek time based on wordBoundaries if startOffset > 0
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
					} catch {}
				};

				audio.addEventListener?.('loadedmetadata', applyInitialSeek, { once: true });
				audio.addEventListener?.('canplay', applyInitialSeek, { once: true });
				applyInitialSeek();

				let nextBoundaryIndex = initialBoundaryIndex;

				const syncWordBoundary = () => {
					if (edgeAudioRef.current !== audio || !isPlayingRef.current || playSessionIdRef.current !== sessionId) {
						return;
					}

					let activeBoundary = null as (typeof wordBoundaries)[number] | null;
					while (nextBoundaryIndex < wordBoundaries.length && wordBoundaries[nextBoundaryIndex].startSeconds <= audio.currentTime) {
						activeBoundary = wordBoundaries[nextBoundaryIndex];
						nextBoundaryIndex += 1;
					}
					if (activeBoundary) {
						updateWordHighlight(index, activeBoundary.charIndex, activeBoundary.charLength);
					}
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
					// Immediate highlight of starting word if seeking into middle of chunk
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
					if (index >= chunks.length - 1) {
						clearResumePosition();
					}
					if (isPlayingRef.current && playSessionIdRef.current === sessionId) {
						playChunkViaEdge(index + 1, sessionId, 0);
					}
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
			})
			.catch((err) => {
				if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.warn('[Edge TTS] Synthesis error, fallback to browser voice:', err);
				playChunkViaBrowser(index, 0, sessionId);
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
		}
	};
}

function initialBoundary(words: EdgeSpeechWithBoundaries['wordBoundaries'], offset: number): { time: number; index: number } {
	if (offset <= 0 || words.length === 0) return { time: 0, index: 0 };
	const index = words.findIndex((word) => word.charIndex >= offset || word.charIndex + word.charLength > offset);
	if (index < 0) return { time: 0, index: 0 };
	return { time: words[index].startSeconds, index };
}
