import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { BackgroundAudioKeepAlive } from '@/services/backgroundAudioKeepAlive';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { EdgeTTSService, getGatewayBaseUrl, type EdgeSpeechWithBoundaries } from '@/services/edgeTtsService';
import { GaplessTtsPlayer, splitByDatabaseBoundaries, type SentenceChunk, WebAudioPlaybackEngine } from '@/services/gaplessTtsPlayer';
import { NativeTTSService } from '@/services/nativeTtsService';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { bindNativeReadingInteraction } from '@/services/nativeReadingInteraction';
import { buildReadAloudUtterancePlanFromChunks } from '@/services/readAloudUtterancePlan';
import { TTSService, DEFAULT_VIENEU_SERVER_URL, type VieNeuRequestContext } from '@/services/ttsService';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

export { splitParagraphIntoSentences } from '@/services/gaplessTtsPlayer';
export { useNativeReadAloud } from './useNativeReadAloud';

const WORD_HIGHLIGHT_CLASS = 'stories-tts-word-highlight';
// Keep a grouped source line in one request whenever possible. The API accepts
// up to 512 chars; 480 leaves headroom for request normalization.

export interface ReadAloudChapterContext {
	bookId?: string;
	bookName?: string;
	chapterId?: string;
	chapterNumber?: number;
	chapterTitle?: string;
}

interface ReadAloudResumePosition {
	chunkIndex: number;
	charOffset: number;
	paragraphIndex?: number;
	sourceOffset?: number;
	version?: 2;
}

export function useReadAloud(paragraphs: string[], chapterContext: ReadAloudChapterContext = {}, paragraphContexts: ReadAloudChapterContext[] = []) {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const voiceUri = useReaderConfigStore((state) => state.voiceUri);
	const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
	const speechRate = useReaderConfigStore((state) => state.speechRate);
	const speechRateRef = useRef(speechRate);
	speechRateRef.current = speechRate;
	const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
	const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);
	const vieneuModel = useReaderConfigStore((state) => state.vieneuModel || undefined);
	const vieneuTemperature = useReaderConfigStore((state) => state.vieneuTemperature ?? 0.8);
	const vieneuTopK = useReaderConfigStore((state) => state.vieneuTopK ?? 25);
	const vieneuTopP = useReaderConfigStore((state) => state.vieneuTopP ?? 0.95);
	const vieneuMaxNewFrames = useReaderConfigStore((state) => state.vieneuMaxNewFrames ?? 300);
	const vieneuRepetitionPenalty = useReaderConfigStore((state) => state.vieneuRepetitionPenalty ?? 1.2);
	const vieneuRepetitionWindow = useReaderConfigStore((state) => state.vieneuRepetitionWindow ?? 80);
	const vieneuSteps = useReaderConfigStore((state) => state.vieneuSteps ?? 8);
	const vieneuCfg = useReaderConfigStore((state) => state.vieneuCfg ?? 2.0);
	const vieneuSway = useReaderConfigStore((state) => state.vieneuSway ?? -1.0);
	const vieneuMaxChars = useReaderConfigStore((state) => state.vieneuMaxChars ?? 140);
	const vieneuDenoise = useReaderConfigStore((state) => state.vieneuDenoise ?? true);
	const vieneuUseRefCodes = useReaderConfigStore((state) => state.vieneuUseRefCodes ?? true);
	const vieneuApplyWatermark = useReaderConfigStore((state) => state.vieneuApplyWatermark ?? true);
	const vieneuOutputSampleRate = useReaderConfigStore((state) => state.vieneuOutputSampleRate ?? 0);
	const vieneuOptions = useMemo(
		() => ({
			temperature: vieneuTemperature,
			top_k: vieneuTopK,
			top_p: vieneuTopP,
			max_new_frames: vieneuMaxNewFrames,
			repetition_penalty: vieneuRepetitionPenalty,
			repetition_window: vieneuRepetitionWindow,
			steps: vieneuSteps,
			cfg: vieneuCfg,
			sway: vieneuSway,
			max_chars: vieneuMaxChars,
			denoise: vieneuDenoise,
			use_ref_codes: vieneuUseRefCodes,
			apply_watermark: vieneuApplyWatermark,
			...(vieneuOutputSampleRate ? { output_sample_rate: vieneuOutputSampleRate as 24000 | 48000 } : {})
		}),
		[
			vieneuTemperature,
			vieneuTopK,
			vieneuTopP,
			vieneuMaxNewFrames,
			vieneuRepetitionPenalty,
			vieneuRepetitionWindow,
			vieneuSteps,
			vieneuCfg,
			vieneuSway,
			vieneuMaxChars,
			vieneuDenoise,
			vieneuUseRefCodes,
			vieneuApplyWatermark,
			vieneuOutputSampleRate
		]
	);

	const getVieneuOptionsForSegment = (text: string) => ({
		...vieneuOptions,
		// max_chars is also used by the model as its text budget. Never let the
		// configured default truncate a complete source line selected by marker.
		max_chars: Math.min(512, Math.max(vieneuOptions.max_chars ?? 140, text.length))
	});

	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
	const gaplessPlayerRef = useRef<GaplessTtsPlayer | null>(null);
	const wordHighlighterRef = useRef<DomWordHighlighter | null>(null);
	if (!wordHighlighterRef.current) {
		wordHighlighterRef.current = new DomWordHighlighter(WORD_HIGHLIGHT_CLASS);
	}
	const scrollFollowerRef = useRef<ReadAloudScrollFollower | null>(null);
	if (!scrollFollowerRef.current) {
		scrollFollowerRef.current = new ReadAloudScrollFollower();
	}
	const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	// Edge can share its native SpeechSynthesis queue across same-site tabs.
	// Track whether this hook instance has actually put an utterance on that
	// queue so an idle tab cannot cancel another tab's narration.
	const ownsBrowserSpeechQueueRef = useRef(false);
	const backgroundAudioRef = useRef<BackgroundAudioKeepAlive | null>(null);
	if (!backgroundAudioRef.current) {
		backgroundAudioRef.current = new BackgroundAudioKeepAlive();
	}

	const chapterId = chapterContext?.chapterId;
	const getResumePosition = useCallback((): ReadAloudResumePosition | null => {
		if (!chapterId || typeof window === 'undefined') return null;
		try {
			const saved = localStorage.getItem(`stories_tts_pos_${chapterId}`);
			if (!saved) return null;
			const parsed = JSON.parse(saved);
			if (typeof parsed.chunkIndex === 'number' && parsed.chunkIndex >= 0) {
				return parsed;
			}
		} catch {}
		return null;
	}, [chapterId]);

	const saveResumePosition = useCallback(
		(chunkIndex: number, charOffset: number, paragraphIndex?: number, sourceOffset?: number) => {
			if (!chapterId || typeof window === 'undefined') return;
			try {
				const position: ReadAloudResumePosition = { chunkIndex, charOffset };
				if (paragraphIndex !== undefined && sourceOffset !== undefined) {
					position.paragraphIndex = paragraphIndex;
					position.sourceOffset = sourceOffset;
					position.version = 2;
				}
				localStorage.setItem(`stories_tts_pos_${chapterId}`, JSON.stringify(position));
			} catch {}
		},
		[chapterId]
	);

	const clearResumePosition = useCallback(() => {
		if (!chapterId || typeof window === 'undefined') return;
		try {
			localStorage.removeItem(`stories_tts_pos_${chapterId}`);
		} catch {}
	}, [chapterId]);

	const clearAllStaleResumePositions = useCallback((currentChapId?: string) => {
		if (typeof window === 'undefined') return;
		try {
			const currentKey = currentChapId ? `stories_tts_pos_${currentChapId}` : null;
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				const isStale = key?.startsWith('stories_tts_pos_') && key !== currentKey;
				if (isStale && key) {
					localStorage.removeItem(key);
				}
			}
		} catch (err) {
			console.debug('[ReadAloud] Clear stale positions error ignored:', err);
		}
	}, []);

	useEffect(() => {
		clearAllStaleResumePositions(chapterId);
	}, [chapterId, clearAllStaleResumePositions]);

	const wakeLockRef = useRef<any>(null);
	const requestWakeLock = useCallback(async () => {
		if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
			try {
				wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
			} catch {}
		}
	}, []);

	const releaseWakeLock = useCallback(() => {
		if (wakeLockRef.current) {
			try {
				wakeLockRef.current.release();
			} catch {}
			wakeLockRef.current = null;
		}
	}, []);

	const currentChunkIdxRef = useRef<number>(0);
	const isPlayingRef = useRef(false);
	const isPausedRef = useRef(false);
	const playSessionIdRef = useRef<number>(0);
	const charIndexRef = useRef(-1);
	const charLengthRef = useRef(0);
	const currentParagraphIndexRef = useRef(-1);

	const chunks = useMemo(() => {
		const res: SentenceChunk[] = [];
		paragraphs.forEach((html, pIdx) => {
			if (!html) return;
			const tmp = document.createElement('div');
			tmp.innerHTML = html;
			const text = tmp.textContent || tmp.innerText || '';

			if (text.trim()) {
				// Paragraphs are already sentence units from getChapterContent. The
				// only valid subdivision is the invisible DB grouping delimiter.
				const sentenceChunks = splitByDatabaseBoundaries(text, pIdx);
				res.push(...sentenceChunks);
			}
		});
		return res.map((sentence, sentenceIndex) => ({
			...sentence,
			sentenceStartIndex: sentenceIndex,
			sentenceEndIndex: sentenceIndex
		}));
	}, [paragraphs]);
	const media3Utterances = useMemo(() => buildReadAloudUtterancePlanFromChunks(chunks), [chunks]);
	const getMedia3UtteranceIndex = (chunkIndex: number, sourceOffset?: number): number => {
		const utteranceIndex = media3Utterances.findIndex((utterance) => utterance.sourceChunkIndex === chunkIndex && (sourceOffset === undefined || sourceOffset < utterance.sourceStart + utterance.sourceLength));
		return utteranceIndex >= 0 ? utteranceIndex : 0;
	};

	const segmentMetadata = useMemo(() => {
		const totals = new Map<string, number>();
		const indexes = new Map<string, number>();
		const contextForChunk = (chunk: SentenceChunk) => paragraphContexts[chunk.pIdx] || chapterContext;
		for (const chunk of chunks) {
			const context = contextForChunk(chunk);
			const key = `${context.bookId || ''}:${context.chapterId || ''}:${context.chapterNumber || 0}`;
			totals.set(key, (totals.get(key) || 0) + 1);
		}
		return chunks.map((chunk) => {
			const context = contextForChunk(chunk);
			const key = `${context.bookId || ''}:${context.chapterId || ''}:${context.chapterNumber || 0}`;
			const segmentIndex = indexes.get(key) || 0;
			indexes.set(key, segmentIndex + 1);
			return {
				context,
				segmentIndex,
				segmentCount: totals.get(key) || chunks.length
			};
		});
	}, [chapterContext, chunks, paragraphContexts]);

	const activeParagraphIndex = currentChunkIndex >= 0 && chunks[currentChunkIndex] ? chunks[currentChunkIndex].pIdx : -1;

	// Sync state with global useTTSStore
	useEffect(() => {
		useTTSStore.setState({
			isPlaying,
			isPaused,
			isLoading,
			currentParagraphIndex: activeParagraphIndex,
			currentCharIndex: charIndexRef.current,
			currentCharLength: charLengthRef.current
		});
	}, [isPlaying, isPaused, isLoading, activeParagraphIndex]);

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

	const stopAudioPlayer = (clearPrefetch = false) => {
		releaseEdgeAudio();
		edgePrefetchQueueRef.current = [];
		if (clearPrefetch) {
			edgeRequestAbortRef.current?.abort();
			edgeRequestAbortRef.current = null;
			edgePrefetchCacheRef.current.clear();
		}
		const player = gaplessPlayerRef.current;
		gaplessPlayerRef.current = null;
		if (player) {
			void player.dispose().catch((error: unknown) => {
				console.warn('Failed to dispose VieNeu audio player:', error);
			});
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
		const promise = EdgeTTSService.synthesizeSpeechWithBoundaries(
			chunk.text,
			edgeVoiceUri,
			currentSpeechRate,
			activeDomain?.url,
			edgeRequestAbortRef.current.signal
		).catch((err) => {
			edgePrefetchCacheRef.current.delete(index);
			throw err;
		});

		edgePrefetchCacheRef.current.set(index, promise);
		return promise;
	};

	const processPrefetchQueue = () => {
		while (
			edgeActivePrefetchCountRef.current < PREFETCH_CONCURRENCY_LIMIT &&
			edgePrefetchQueueRef.current.length > 0
		) {
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
			if (targetIdx < chunks.length && !edgePrefetchCacheRef.current.has(targetIdx)) {
				if (!edgePrefetchQueueRef.current.includes(targetIdx)) {
					edgePrefetchQueueRef.current.push(targetIdx);
				}
			}
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
				let initialSeekTime = 0;
				let initialBoundaryIndex = 0;
				if (startOffset > 0 && wordBoundaries.length > 0) {
					// Find the closest word boundary matching startOffset
					const targetBoundaryIdx = wordBoundaries.findIndex(
						(wb) => wb.charIndex >= startOffset || wb.charIndex + wb.charLength > startOffset
					);
					if (targetBoundaryIdx !== -1) {
						initialSeekTime = wordBoundaries[targetBoundaryIdx].startSeconds;
						initialBoundaryIndex = targetBoundaryIdx;
					}
				}

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
					if (initialSeekTime > 0) {
						const startingBoundary = (initialBoundaryIndex < wordBoundaries.length && wordBoundaries[initialBoundaryIndex]) || wordBoundaries[0];
						if (startingBoundary) {
							updateWordHighlight(index, startingBoundary.charIndex, startingBoundary.charLength);
						}
					}
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

	const playChunk = (index: number, startOffset: number = 0) => {
		const sessionId = playSessionIdRef.current;
		if (ttsEngine === 'browser') {
			playChunkViaBrowser(index, startOffset, sessionId);
		} else if (ttsEngine === 'edge') {
			playChunkViaEdge(index, sessionId, startOffset);
		} else {
			playChunkViaVieNeu(index, sessionId, startOffset);
		}
	};

	const stopReading = (clearSaved = false) => {
		// Kiểm tra xem luồng đọc trước đó có đang thực sự chạy hoặc tạm dừng không
		const wasActive = isPlayingRef.current || isPausedRef.current || isLoading;
		const ownsBrowserSpeechQueue = ownsBrowserSpeechQueueRef.current;

		if (!clearSaved && wasActive && currentChunkIdxRef.current < chunks.length - 1) {
			saveResumePosition(
				currentChunkIdxRef.current,
				charIndexRef.current > 0 ? charIndexRef.current : 0,
				currentParagraphIndexRef.current >= 0 ? currentParagraphIndexRef.current : undefined,
				charIndexRef.current > 0 ? charIndexRef.current : undefined
			);
		} else if (clearSaved) {
			clearResumePosition();
		}

		releaseWakeLock();
		setIsPlaying(false);
		setIsPaused(false);
		setIsLoading(false);
		isPlayingRef.current = false;
		isPausedRef.current = false;
		playSessionIdRef.current += 1;

		stopAudioPlayer(true);
		backgroundAudioRef.current?.stop();
		wordHighlighterRef.current?.clear();
		scrollFollowerRef.current?.cancel();

		// Chỉ kích hoạt lệnh stop xuống các dịch vụ Native khi TTS thực sự đang phát hoặc dở dang,
		// ngăn chặn hoàn toàn việc spam IPC và gửi RemoteLogger vô nghĩa khi người dùng chỉ lướt trang
		if (wasActive) {
			if (NativeTTSService.isNative()) {
				void NativeTTSService.stop();
			}
			if (NativeTTSStreamService.isAvailable()) {
				void NativeTTSStreamService.stop();
			}
			if (EdgeTTSNativeStreamService.isAvailable()) {
				void EdgeTTSNativeStreamService.stop();
			}
		}

		if (ownsBrowserSpeechQueue && synth) synth.cancel();
		ownsBrowserSpeechQueueRef.current = false;
		utteranceRef.current = null;

		currentChunkIdxRef.current = 0;
		setCurrentChunkIndex(-1);
		charIndexRef.current = -1;
		charLengthRef.current = 0;
		useTTSStore.setState({ currentCharIndex: -1, currentCharLength: 0, isLoading: false });
	};

		// Ngăn chặn hoàn toàn việc tự động pre-warming EdgeTTS khi người dùng chỉ lướt web mà không bật đọc

	const lastInteractionTime = useRef(0);

	const updateWordHighlight = (chunkIndex: number, nextCharIndex: number, nextCharLength: number) => {
		const highlighter = wordHighlighterRef.current;
		if (!highlighter || !chunks[chunkIndex]) return;

		const readerContent = document.querySelector('#main-story-content');
		if (!readerContent) {
			return;
		}

		const chunk = chunks[chunkIndex];
		const pNode = readerContent.querySelector<HTMLElement>(`article > div[data-paragraph-index="${chunk.pIdx}"]`);
		if (!pNode) {
			return;
		}
		if (nextCharIndex < 0 || nextCharLength <= 0) {
			highlighter.clear();
			return;
		}

		if (
			charIndexRef.current === nextCharIndex &&
			charLengthRef.current === nextCharLength &&
			useTTSStore.getState().currentParagraphIndex === chunk.pIdx
		) {
			return;
		}

		const wordText = chunk.text.substring(nextCharIndex, nextCharIndex + nextCharLength);
		const match = wordText.match(/[^\s.,!?:;'"(){}[\]“”‘’\-–—]+/);
		if (!match || match.index === undefined) {
			return;
		}

		charIndexRef.current = nextCharIndex;
		charLengthRef.current = nextCharLength;
		useTTSStore.setState({
			currentParagraphIndex: chunk.pIdx,
			currentCharIndex: nextCharIndex,
			currentCharLength: nextCharLength
		});
		currentParagraphIndexRef.current = chunk.pIdx;

		const offset = nextCharIndex + match.index;
		const geometry = highlighter.highlight(pNode, chunk.startOffset + offset, match[0].length);
		if (geometry?.line) {
			scrollFollowerRef.current?.follow(geometry.line);
		}
	};

	const updateMedia3Highlight = (
		chunkIndex: number,
		paragraphIndex: number,
		sourceStart: number,
		wordCharIndex: number,
		wordCharLength: number
	) => {
		const highlighter = wordHighlighterRef.current;
		if (!highlighter || wordCharIndex < 0 || wordCharLength <= 0) return;
		const readerContent = document.querySelector('#main-story-content');
		const paragraphNode = readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${paragraphIndex}"]`);
		if (!paragraphNode) return;
		const absoluteWordIndex = sourceStart + wordCharIndex;
		if (currentParagraphIndexRef.current === paragraphIndex && charIndexRef.current === absoluteWordIndex && charLengthRef.current === wordCharLength) return;

		currentChunkIdxRef.current = chunkIndex;
		currentParagraphIndexRef.current = paragraphIndex;
		charIndexRef.current = sourceStart + wordCharIndex;
		charLengthRef.current = wordCharLength;
		useTTSStore.setState({
			currentParagraphIndex: paragraphIndex,
			currentCharIndex: sourceStart + wordCharIndex,
			currentCharLength: wordCharLength
		});
		const geometry = highlighter.highlight(paragraphNode, absoluteWordIndex, wordCharLength);
		if (geometry?.lineChanged) scrollFollowerRef.current?.follow(geometry.line);
	};

	const activeNativeStream = useMemo(() => {
		if (ttsEngine === 'edge' && EdgeTTSNativeStreamService.isAvailable()) {
			return EdgeTTSNativeStreamService;
		}
		if (ttsEngine === 'browser' && NativeTTSStreamService.isAvailable()) {
			return NativeTTSStreamService;
		}
		return null;
	}, [ttsEngine]);

	// Native Android Streaming Event Listeners (both Edge and Device TTS)
	useEffect(() => {
		if (!activeNativeStream) return;

		const unsubChunk = activeNativeStream.onChunkStart((idx) => {
			if (!isPlayingRef.current) return;
			currentChunkIdxRef.current = idx;
			setCurrentChunkIndex(idx);
			setIsLoading(false);
			saveResumePosition(idx, 0);
		});

		const unsubWord = activeNativeStream.onWordBoundary((event) => {
			if (!isPlayingRef.current) return;
			const { chunkIndex, charIndex, charLength, paragraphIndex, sourceStart, sourceLength } = event;
			if (paragraphIndex !== undefined && sourceStart !== undefined && sourceLength !== undefined) {
				updateMedia3Highlight(chunkIndex, paragraphIndex, sourceStart, charIndex, charLength);
				return;
			}
			updateWordHighlight(chunkIndex, charIndex, charLength);
		});

		const unsubState = activeNativeStream.onPlaybackStateChange(({ isPlaying: p, isPaused: pa, isBuffering: b }) => {
			if (p) {
				setIsPlaying(true);
				isPlayingRef.current = true;
			}
			setIsPaused(pa);
			isPausedRef.current = pa;
			setIsLoading(b);
		});

		const unsubDone = activeNativeStream.onPlaybackComplete(() => {
			if (!isPlayingRef.current) return;
			clearResumePosition();
			stopReading(true);
		});

		return () => {
			unsubChunk();
			unsubWord();
			unsubState();
			unsubDone();
		};
	}, [activeNativeStream, chunks, saveResumePosition, clearResumePosition]);

	useEffect(() => {
		stopReading();
	}, [paragraphs]);

	useEffect(() => {
		if (ttsEngine === 'vieneu') {
			stopReading();
		}
	}, [vieneuModel, voiceUri, ttsEngine, vieneuOptions]);

	useEffect(() => {
		const onInteraction = () => {
			lastInteractionTime.current = Date.now();
			scrollFollowerRef.current?.notifyUserInteraction();
		};
		if (hasNativeReaderGestures() && scrollFollowerRef.current) {
			const unsubscribe = bindNativeReadingInteraction(scrollFollowerRef.current, () => { lastInteractionTime.current = Date.now(); });
			return () => { unsubscribe(); scrollFollowerRef.current?.cancel(); };
		}
		const onHold = () => scrollFollowerRef.current?.beginUserInteraction();
		const onRelease = () => scrollFollowerRef.current?.endUserInteraction();
		const onPointerHold = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			onHold();
		};
		const onPointerRelease = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			onRelease();
		};
		const onScroll = () => scrollFollowerRef.current?.notifyViewportScroll();
		const onSelection = () => scrollFollowerRef.current?.notifySelectionChange();
		document.addEventListener('selectionchange', onSelection);
		window.addEventListener('wheel', onInteraction, { passive: true });
		window.addEventListener('touchmove', onInteraction, { passive: true });
		window.addEventListener('touchstart', onHold, { passive: true });
		window.addEventListener('pointerdown', onPointerHold, { passive: true });
		window.addEventListener('pointerup', onPointerRelease, { passive: true });
		window.addEventListener('pointercancel', onPointerRelease, { passive: true });
		window.addEventListener('touchend', onRelease, { passive: true });
		window.addEventListener('touchcancel', onRelease, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('keydown', onInteraction, { passive: true });
		return () => {
			document.removeEventListener('selectionchange', onSelection);
			window.removeEventListener('wheel', onInteraction);
			window.removeEventListener('touchmove', onInteraction);
			window.removeEventListener('touchstart', onHold);
			window.removeEventListener('pointerdown', onPointerHold);
			window.removeEventListener('pointerup', onPointerRelease);
			window.removeEventListener('pointercancel', onPointerRelease);
			window.removeEventListener('touchend', onRelease);
			window.removeEventListener('touchcancel', onRelease);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('keydown', onInteraction);
			scrollFollowerRef.current?.cancel();
		};
	}, []);

	useEffect(() => {
		const onVisibilityChange = () => {
			// A tab becoming hidden also fires this event. Calling play() while the
			// Edge audio is already playing can make Edge re-negotiate its media
			// session in the background, which presents as a skipped read-aloud
			// segment when the reader is revisited. Only recover playback after the
			// page is visible again, and only if the browser actually paused it.
			if (document.visibilityState !== 'visible') return;
			if (!isPlayingRef.current || isPausedRef.current) return;

			backgroundAudioRef.current?.resume();
			if (ttsEngine === 'vieneu') {
				void gaplessPlayerRef.current?.resume().catch(() => {});
			} else if (ttsEngine === 'edge') {
				if (edgeAudioRef.current?.paused) {
					void edgeAudioRef.current.play().catch(() => {});
				}
			} else if (ownsBrowserSpeechQueueRef.current) {
				synth?.resume();
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('pageshow', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('pageshow', onVisibilityChange);
		};
	}, [ttsEngine, synth]);

	useEffect(() => {
		if (!isPlaying && !isPaused && !isLoading) return;
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

		const mediaSession = navigator.mediaSession;
		mediaSession.metadata = new MediaMetadata({ title: 'VietNeu Read Aloud' });
		const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
			['play', () => startReading()],
			['pause', () => pauseReading()],
			['nexttrack', () => nextSection()],
			['previoustrack', () => prevSection()]
		];
		handlers.forEach(([action, handler]) => {
			try {
				mediaSession.setActionHandler(action, handler);
			} catch {
				// Some browsers expose Media Session but do not support every action.
			}
		});
		return () => {
			handlers.forEach(([action]) => {
				try {
					mediaSession.setActionHandler(action, null);
				} catch {
					// Ignore unsupported action cleanup.
				}
			});
		};
	}, [chunks.length, isLoading, isPaused, isPlaying]);

	useEffect(() => {
		return () => {
			wordHighlighterRef.current?.dispose();
			scrollFollowerRef.current?.cancel();
			stopReading();
		};
	}, []);

	const playChunkViaBrowser = (index: number, startOffset: number = 0, sessionId: number) => {
		if (NativeTTSService.isNative()) {
			if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
			if (index >= chunks.length) {
				clearResumePosition();
				stopReading(true);
				return;
			}

			currentChunkIdxRef.current = index;
			setCurrentChunkIndex(index);
			charIndexRef.current = startOffset;
			charLengthRef.current = 0;
			wordHighlighterRef.current?.clear();

			const chunk = chunks[index];
			const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

			if (!textToSpeak.trim()) {
				playChunkViaBrowser(index + 1, 0, sessionId);
				return;
			}

			const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;
			NativeTTSService.speak({
				text: textToSpeak,
				voice: voiceUri,
				rate: currentSpeechRate,
				utteranceId: `${sessionId}-${index}`,
				onStart: () => {
					if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
						setIsLoading(false);
						setIsPlaying(true);
					}
				},
				onRangeStart: (start, end) => {
					if (playSessionIdRef.current === sessionId) {
						let charLen = end - start;
						if (charLen <= 0) {
							const remaining = textToSpeak.slice(start);
							const nextDelim = remaining.search(/[\s.,!?:;'"(){}[\]“”‘’\-–—]/);
							charLen = nextDelim > 0 ? nextDelim : Math.min(remaining.length, 6);
						}
						updateWordHighlight(index, startOffset + start, charLen);
					}
				},
				onDone: () => {
					if (playSessionIdRef.current !== sessionId) return;
					if (index >= chunks.length - 1) {
						clearResumePosition();
					}
					if (isPlayingRef.current && !isPausedRef.current) {
						playChunk(index + 1, 0);
					}
				},
				onError: (err) => {
					if (playSessionIdRef.current !== sessionId) return;
					console.warn('[NativeTTS] Playback error:', err);
					if (isPlayingRef.current && !isPausedRef.current) {
						playChunk(index + 1, 0);
					}
				}
			}).catch((err) => {
				if (playSessionIdRef.current !== sessionId) return;
				console.warn('[NativeTTS] Speak exception:', err);
				if (isPlayingRef.current && !isPausedRef.current) {
					playChunk(index + 1, 0);
				}
			});
			return;
		}

		if (!synth || !isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			stopReading();
			return;
		}

		currentChunkIdxRef.current = index;
		setCurrentChunkIndex(index);
		charIndexRef.current = startOffset;
		charLengthRef.current = 0;
		wordHighlighterRef.current?.clear();

		const chunk = chunks[index];
		const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

		if (!textToSpeak.trim()) {
			playChunkViaBrowser(index + 1, 0, sessionId);
			return;
		}

		const utterance = new SpeechSynthesisUtterance(textToSpeak);
		utterance.rate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;

		const voices = synth.getVoices();
		const selectedVoice = voices.find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
		if (selectedVoice) {
			utterance.voice = selectedVoice;
		}

		utterance.onstart = () => {
			if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
				setIsLoading(false);
				setIsPlaying(true);
			}
		};

		utterance.onboundary = (e) => {
			if (playSessionIdRef.current !== sessionId) return;
			if (e.name === 'word') {
				let charLen = e.charLength || 0;
				if (charLen <= 0) {
					const remaining = textToSpeak.slice(e.charIndex);
					const nextDelim = remaining.search(/[\s.,!?:;'"(){}[\]“”‘’\-–—]/);
					charLen = nextDelim > 0 ? nextDelim : Math.min(remaining.length, 6);
				}
				updateWordHighlight(index, startOffset + e.charIndex, charLen);
			}
		};

		utterance.onend = () => {
			if (playSessionIdRef.current !== sessionId) return;
			if (utteranceRef.current === utterance) {
				utteranceRef.current = null;
				ownsBrowserSpeechQueueRef.current = false;
			}
			if (isPlayingRef.current && !isPausedRef.current) {
				playChunk(index + 1, 0);
			}
		};

		utterance.onerror = (e) => {
			if (playSessionIdRef.current !== sessionId) return;
			if (utteranceRef.current === utterance) {
				utteranceRef.current = null;
				ownsBrowserSpeechQueueRef.current = false;
			}
			if (e.error === 'canceled') return;
			console.warn('Browser SpeechSynthesis error:', e.error);
			if (isPlayingRef.current && !isPausedRef.current) {
				playChunk(index + 1, 0);
			}
		};

		utteranceRef.current = utterance;
		ownsBrowserSpeechQueueRef.current = true;
		synth.speak(utterance);
	};

	const playChunkViaVieNeu = (index: number, sessionId: number, startOffset: number = 0) => {
		if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			stopReading();
			return;
		}

		const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextConstructor) {
			console.warn('Web Audio API is unavailable, falling back to browser voice.');
			playChunkViaBrowser(index, startOffset, sessionId);
			return;
		}

		stopAudioPlayer();
		const audioContext = new AudioContextConstructor();
		const activeVoice = voiceUri || undefined;
		// WebAudio's native playbackRate changes pitch (especially at 1.6x–2x),
		// so let VieNeu apply the rate and keep the PCM player at neutral speed.
		// A true FE-only speed change needs an AudioWorklet time-stretcher.
		const vieneuSynthesisSpeed = speechRate;
		const requestContextForSegment = (segment: SentenceChunk): VieNeuRequestContext => {
			const absoluteIndex = (segment as SentenceChunk & { sentenceStartIndex?: number }).sentenceStartIndex ?? index;
			const metadata = segmentMetadata[absoluteIndex];
			const context = metadata?.context || chapterContext;
			return {
				book_id: context.bookId,
				chapter_id: context.chapterId,
				chapter_number: context.chapterNumber,
				segment_index: metadata?.segmentIndex ?? absoluteIndex,
				segment_count: metadata?.segmentCount ?? chunks.length,
				is_final_segment: (metadata?.segmentIndex ?? absoluteIndex) === (metadata?.segmentCount ?? chunks.length) - 1
			};
		};
		const hasChapterContext = Boolean(chapterContext.bookId && chapterContext.chapterId) || paragraphContexts.some((context) => context.bookId && context.chapterId);
		let activeIndex = index;
		const player = new GaplessTtsPlayer({
			engine: new WebAudioPlaybackEngine(audioContext, 1.0),
			speechRate,
			synthesize: (segment, signal) => {
				const args = [segment.text, activeVoice, vieneuSynthesisSpeed, vieneuServerUrl, signal, vieneuModel, getVieneuOptionsForSegment(segment.text)] as const;
				return hasChapterContext ? TTSService.synthesizeSpeech(...args, requestContextForSegment(segment)) : TTSService.synthesizeSpeech(...args);
			},
			stream: (segment, signal) => {
				const args = [segment.text, activeVoice, vieneuSynthesisSpeed, vieneuServerUrl, signal, vieneuModel, getVieneuOptionsForSegment(segment.text)] as const;
				return hasChapterContext ? TTSService.streamSpeech(...args, requestContextForSegment(segment)) : TTSService.streamSpeech(...args);
			},
			// Warm the complete next source paragraph while the current one plays.
			// This avoids waiting on sentence 2+ without issuing requests for the
			// entire chapter at startup. The second paragraph provides a safety
			// buffer when this private VPS has a transiently slower inference turn.
			prefetchByParagraph: true,
			prefetchParagraphsAhead: 2
		});
		gaplessPlayerRef.current = player;

		const targetChunks = chunks.slice(index);
		if (startOffset > 0 && targetChunks.length > 0) {
			const first = targetChunks[0];
			const partialText = first.text.substring(startOffset);
			targetChunks[0] = {
				...first,
				text: partialText,
				startOffset: first.startOffset + startOffset,
				length: partialText.length
			};
		}

		player.start(targetChunks, {
			onSegmentStart: (relativeIndex) => {
				if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
				setIsLoading(false);
				setIsPlaying(true);
				activeIndex = index + relativeIndex;
			},
			onWordBoundary: (relativeIndex, _segment, cue) => {
				if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
				setIsLoading(false);
				setIsPlaying(true);
				activeIndex = index + relativeIndex;
				if (currentChunkIdxRef.current !== activeIndex) {
					currentChunkIdxRef.current = activeIndex;
					setCurrentChunkIndex(activeIndex);
				}
				const baseOffset = relativeIndex === 0 ? startOffset : 0;
				updateWordHighlight(activeIndex, cue.charIndex + baseOffset, cue.charLength);
			},
			onFinished: () => {
				if (playSessionIdRef.current !== sessionId) return;
				gaplessPlayerRef.current = null;
				void player.dispose();
				stopReading();
			},
			onError: (error: unknown) => {
				if (playSessionIdRef.current !== sessionId) return;
				console.warn('VieNeu TTS playback failed, falling back to browser voice:', error);
				gaplessPlayerRef.current = null;
				void player.dispose();
				playChunkViaBrowser(activeIndex, 0, sessionId);
			}
		});
	};

	const startReading = (targetIndex?: number, targetOffset?: number) => {
		scrollFollowerRef.current?.resumeFollowing();
		void requestWakeLock();
		if (isPaused && targetIndex === undefined) {
			setIsPaused(false);
			setIsPlaying(true);
			setIsLoading(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			backgroundAudioRef.current?.start();

			if (activeNativeStream) {
				void activeNativeStream.resume();
			} else if (ttsEngine === 'vieneu' && gaplessPlayerRef.current) {
				void gaplessPlayerRef.current.resume().catch(() => playChunk(currentChunkIdxRef.current));
			} else if (ttsEngine === 'browser') {
				if (NativeTTSService.isNative()) {
					playChunk(currentChunkIdxRef.current, charIndexRef.current > 0 ? charIndexRef.current : 0);
				} else if (synth) {
					synth.resume();
				}
			} else if (ttsEngine === 'edge') {
				if (edgeAudioRef.current) {
					void edgeAudioRef.current.play().catch(() => playChunk(currentChunkIdxRef.current));
				} else {
					playChunk(currentChunkIdxRef.current);
				}
			} else {
				playChunk(currentChunkIdxRef.current);
			}
			return;
		}

		const newSessionId = playSessionIdRef.current + 1;
		playSessionIdRef.current = newSessionId;

		stopAudioPlayer();
		if (ownsBrowserSpeechQueueRef.current && synth) synth.cancel();
		ownsBrowserSpeechQueueRef.current = false;
		utteranceRef.current = null;

		setIsLoading(true);
		setIsPlaying(false);
		setIsPaused(false);
		isPlayingRef.current = true;
		isPausedRef.current = false;
		backgroundAudioRef.current?.start();

		let targetIdx = targetIndex !== undefined ? targetIndex : currentChunkIdxRef.current;
		let targetOff = targetOffset !== undefined ? targetOffset : 0;

		// If starting from 0 (or no target specified), check if we have a saved resume position for this chapter!
		if (targetIndex === undefined && targetIdx === 0) {
				const saved = getResumePosition();
				if (saved?.version === 2 && saved.paragraphIndex !== undefined && saved.sourceOffset !== undefined) {
					const migratedIndex = chunks.findIndex(
						(chunk) => chunk.pIdx === saved.paragraphIndex && saved.sourceOffset! >= chunk.startOffset && saved.sourceOffset! < chunk.startOffset + chunk.length
					);
					if (migratedIndex >= 0) {
						targetIdx = migratedIndex;
						targetOff = Math.max(0, saved.sourceOffset - chunks[migratedIndex].startOffset);
					}
				} else if (saved && saved.chunkIndex < chunks.length) {
					targetIdx = saved.chunkIndex;
					targetOff = saved.charOffset || 0;
			}
		}

		if (targetIdx >= chunks.length) {
			targetIdx = 0;
			targetOff = 0;
			clearResumePosition();
		}
		currentChunkIdxRef.current = targetIdx;
		lastInteractionTime.current = 0;

		const targetChunk = chunks[targetIdx];
		if (targetChunk) {
			const readerContent = document.querySelector('#main-story-content');
			const pNode = readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${targetChunk.pIdx}"]`);
			if (typeof pNode?.scrollIntoView === 'function') {
				pNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}

		if (activeNativeStream) {
			setIsPlaying(true);
			setIsLoading(true);
			isPlayingRef.current = true;
			isPausedRef.current = false;
				const textChunks = chunks.map((c) => c.text);
				const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;
				const edgeBufferMode = useReaderConfigStore.getState().edgeBufferMode || 'file';
				const isMedia3Mode = ttsEngine === 'edge' && edgeBufferMode === 'media3';
				const sourceOffset = (chunks[targetIdx]?.startOffset ?? 0) + targetOff;
				const nativeStartIndex = isMedia3Mode ? getMedia3UtteranceIndex(targetIdx, sourceOffset) : targetIdx;
				const playbackUtterances = media3Utterances.map((utterance, index) => {
					if (index !== nativeStartIndex || sourceOffset <= utterance.sourceStart) return utterance;
					const offset = sourceOffset - utterance.sourceStart;
					return { ...utterance, id: `${utterance.id}-from-${sourceOffset}`, text: utterance.text.slice(offset), sourceStart: sourceOffset, sourceLength: utterance.sourceLength - offset };
				});
			const targetVoice = ttsEngine === 'edge' ? (edgeVoiceUri || 'vi-VN-HoaiMyNeural') : voiceUri;

			const bookTitle = chapterContext.bookName || (chapterContext.bookId ? `Truyện #${chapterContext.bookId}` : 'Stories Reader');
			const chapterTitle = chapterContext.chapterTitle
				|| (chapterContext.chapterNumber
					? `Chương ${chapterContext.chapterNumber}`
					: chapterContext.chapterId
						? `Chương ${chapterContext.chapterId}`
						: 'Chương đang đọc');

				void activeNativeStream.startPlayback({
					chunks: textChunks,
					...(isMedia3Mode ? { utterances: playbackUtterances, sessionId: `edge-media3-${newSessionId}` } : {}),
					startIndex: nativeStartIndex,
				voice: targetVoice,
				rate: currentSpeechRate,
				pitch: ttsEngine === 'edge' ? ('+0Hz' as any) : 1.0,
				gatewayUrl: activeDomain?.url || getGatewayBaseUrl(),
				bookTitle,
				chapterTitle,
				bufferMode: edgeBufferMode
			});
			return;
		}

		playChunk(targetIdx, targetOff);
	};

	const pauseReading = () => {
		scrollFollowerRef.current?.cancel();
		releaseWakeLock();
		if (currentChunkIdxRef.current < chunks.length - 1) {
			saveResumePosition(
				currentChunkIdxRef.current,
				charIndexRef.current > 0 ? charIndexRef.current : 0,
				currentParagraphIndexRef.current >= 0 ? currentParagraphIndexRef.current : undefined,
				charIndexRef.current > 0 ? charIndexRef.current : undefined
			);
		}
		setIsPlaying(false);
		setIsPaused(true);
		setIsLoading(false);
		isPlayingRef.current = false;
		isPausedRef.current = true;
		backgroundAudioRef.current?.stop();

		if (gaplessPlayerRef.current) {
			void gaplessPlayerRef.current.pause();
		}
		if (activeNativeStream) {
			void activeNativeStream.pause();
		} else if (ttsEngine === 'browser') {
			if (NativeTTSService.isNative()) {
				void NativeTTSService.stop();
			} else if (ownsBrowserSpeechQueueRef.current && synth) {
				synth.pause();
			}
		} else if (ttsEngine === 'edge') {
			edgeAudioRef.current?.pause();
		}
	};

	const nextSection = () => {
		scrollFollowerRef.current?.resumeFollowing();
		lastInteractionTime.current = 0;
		if (currentChunkIdxRef.current < chunks.length - 1) {
			const nextIdx = currentChunkIdxRef.current + 1;
			playSessionIdRef.current += 1;
			stopAudioPlayer();
			if (ownsBrowserSpeechQueueRef.current && synth) synth.cancel();
			ownsBrowserSpeechQueueRef.current = false;
			utteranceRef.current = null;

			setIsLoading(true);
			setIsPlaying(false);
			setIsPaused(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			currentChunkIdxRef.current = nextIdx;
			if (activeNativeStream) {
				const nativeIndex = useReaderConfigStore.getState().edgeBufferMode === 'media3' ? getMedia3UtteranceIndex(nextIdx) : nextIdx;
				void activeNativeStream.seekToChunk(nativeIndex);
				return;
			}
			playChunk(nextIdx);
		} else {
			clearResumePosition();
			stopReading(true);
		}
	};

	const prevSection = () => {
		scrollFollowerRef.current?.resumeFollowing();
		lastInteractionTime.current = 0;
		if (currentChunkIdxRef.current > 0) {
			const prevIdx = currentChunkIdxRef.current - 1;
			playSessionIdRef.current += 1;
			stopAudioPlayer();
			if (ownsBrowserSpeechQueueRef.current && synth) synth.cancel();
			ownsBrowserSpeechQueueRef.current = false;
			utteranceRef.current = null;

			setIsLoading(true);
			setIsPlaying(false);
			setIsPaused(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			currentChunkIdxRef.current = prevIdx;
			if (activeNativeStream) {
				const nativeIndex = useReaderConfigStore.getState().edgeBufferMode === 'media3' ? getMedia3UtteranceIndex(prevIdx) : prevIdx;
				void activeNativeStream.seekToChunk(nativeIndex);
				return;
			}
			playChunk(prevIdx);
		} else {
			stopReading();
		}
	};

	const jumpToContent = (pIdx: number, textOffset: number = 0) => {
		let targetIndex = chunks.findIndex((c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length);
		if (targetIndex === -1) {
			targetIndex = chunks.findIndex((c) => c.pIdx === pIdx);
		}

		if (targetIndex === -1) return;
		const chunkOffset = Math.max(0, textOffset - chunks[targetIndex].startOffset);
		startReading(targetIndex, chunkOffset);
	};
	const locateReadingLine = () => scrollFollowerRef.current?.locateCurrentLine();

	return {
		isPlaying,
		isPaused,
		isLoading,
		isTTSActive: isPlaying || isPaused || isLoading,
		currentChunkIndex,
		activeParagraphIndex,
		startReading,
		pauseReading,
		stopReading,
		nextSection,
		prevSection,
		jumpToContent,
		locateReadingLine,
		clearResumePosition
	};
}
