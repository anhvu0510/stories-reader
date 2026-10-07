import { resolveReadAloudStart } from './readAloud/readAloudStartPosition';
import { createBrowserSpeechPlayback } from './readAloud/browserSpeechPlayback';
import { createVieNeuPlayback } from './readAloud/vieNeuPlayback';
import { useNativeReadingEvents } from './readAloud/useNativeReadingEvents';
import { useReadAloudHighlight } from './readAloud/useReadAloudHighlight';
import { useVieNeuReadingConfig } from './readAloud/useVieNeuReadingConfig';
import { useReadAloudResume } from './readAloud/useReadAloudResume';
import { useReadingWakeLock } from './readAloud/useReadingWakeLock';
import { useReadAloudPlan } from './readAloud/useReadAloudPlan';
import { useBrowserEdgePlayback } from './readAloud/useBrowserEdgePlayback';
import { useState, useEffect, useRef, useMemo } from 'react';

import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { BackgroundAudioKeepAlive } from '@/services/backgroundAudioKeepAlive';
import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { getGatewayBaseUrl } from '@/services/edgeTtsService';
import { type GaplessTtsPlayer } from '@/services/gaplessTtsPlayer';
import { NativeTTSService } from '@/services/nativeTtsService';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

export { splitParagraphIntoSentences } from '@/services/gaplessTtsPlayer';
export { useReadAloud as useNativeReadAloud };

export interface ReadAloudChapterContext {
	bookId?: string;
	bookName?: string;
	chapterId?: string;
	chapterNumber?: number;
	chapterTitle?: string;
}

export function useReadAloud(paragraphs: string[], chapterContext: ReadAloudChapterContext = {}, paragraphContexts: ReadAloudChapterContext[] = []) {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const voiceUri = useReaderConfigStore((state) => state.voiceUri);
	const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
	const speechRate = useReaderConfigStore((state) => state.speechRate);
	const speechRateRef = useRef(speechRate);
	speechRateRef.current = speechRate;
	const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
	const { vieneuServerUrl, vieneuModel, vieneuOptions, getVieneuOptionsForSegment } = useVieNeuReadingConfig();

	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
	const gaplessPlayerRef = useRef<GaplessTtsPlayer | null>(null);
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

	const { getResumePosition, saveResumePosition, clearResumePosition } = useReadAloudResume(chapterContext.chapterId);

	const { requestWakeLock, releaseWakeLock } = useReadingWakeLock();

	const currentChunkIdxRef = useRef<number>(0);
	const sourceOffsetRef = useRef(0);
	const pendingNativeChunkRef = useRef<number | null>(null);
	const media3UtteranceIndexRef = useRef(0);
	const pendingMedia3UtteranceRef = useRef<number | null>(null);
	const isPlayingRef = useRef(false);
	const nativePlaybackActiveRef = useRef(false);
	const isPausedRef = useRef(false);
	const playSessionIdRef = useRef<number>(0);
	const charIndexRef = useRef(-1);
	const charLengthRef = useRef(0);
	const currentParagraphIndexRef = useRef(-1);

	const { chunks, media3Utterances, getMedia3UtteranceIndex, segmentMetadata } = useReadAloudPlan(paragraphs, chapterContext, paragraphContexts);

	const { wordHighlighterRef, scrollFollowerRef, updateWordHighlight, updateMedia3Highlight } = useReadAloudHighlight(chunks, {
		charIndexRef,
		charLengthRef,
		sourceOffsetRef,
		currentParagraphIndexRef
	});

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

	const edgePlayback = useBrowserEdgePlayback({
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
		stopReading: (clearSaved) => stopReading(clearSaved),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunkViaBrowser: (index, offset, sessionId) => playChunkViaBrowser(index, offset, sessionId)
	});

	const stopAudioPlayer = (clearPrefetch = false) => {
		edgePlayback.stop(clearPrefetch);
		const player = gaplessPlayerRef.current;
		gaplessPlayerRef.current = null;
		if (player) {
			void player.dispose().catch((error: unknown) => {
				console.warn('Failed to dispose VieNeu audio player:', error);
			});
		}
	};

	const playChunk = (index: number, startOffset: number = 0) => {
		const sessionId = playSessionIdRef.current;
		if (ttsEngine === 'browser') {
			playChunkViaBrowser(index, startOffset, sessionId);
		} else if (ttsEngine === 'edge') {
			edgePlayback.play(index, sessionId, startOffset);
		} else {
			playChunkViaVieNeu(index, sessionId, startOffset);
		}
	};

	const stopReading = (clearSaved = false) => {
		nativePlaybackActiveRef.current = false;
		// Kiểm tra xem luồng đọc trước đó có đang thực sự chạy hoặc tạm dừng không
		const wasActive = isPlayingRef.current || isPausedRef.current || isLoading;
		const ownsBrowserSpeechQueue = ownsBrowserSpeechQueueRef.current;

		if (!clearSaved && wasActive && currentChunkIdxRef.current < chunks.length) {
			saveResumePosition(
				currentChunkIdxRef.current,
				charIndexRef.current > 0 ? charIndexRef.current : 0,
				currentParagraphIndexRef.current >= 0 ? currentParagraphIndexRef.current : undefined,
				charIndexRef.current >= 0 ? sourceOffsetRef.current : undefined
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
		if (wasActive && NativeTTSService.isNative()) void NativeTTSService.stop();
		if (wasActive && NativeTTSStreamService.isAvailable()) void NativeTTSStreamService.stop();
		if (wasActive && EdgeTTSNativeStreamService.isAvailable()) void EdgeTTSNativeStreamService.stop();

		if (ownsBrowserSpeechQueue && synth) synth.cancel();
		ownsBrowserSpeechQueueRef.current = false;
		utteranceRef.current = null;

		currentChunkIdxRef.current = 0;
		setCurrentChunkIndex(-1);
		charIndexRef.current = -1;
		charLengthRef.current = 0;
		useTTSStore.setState({ currentCharIndex: -1, currentCharLength: 0, isLoading: false });
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

	useNativeReadingEvents({
		stream: activeNativeStream,
		edge: ttsEngine === 'edge',
		cursor: {
			playing: isPlayingRef,
			paused: isPausedRef,
			active: nativePlaybackActiveRef,
			pendingChunk: pendingNativeChunkRef,
			pendingUtterance: pendingMedia3UtteranceRef,
			chunk: currentChunkIdxRef,
			utterance: media3UtteranceIndexRef,
			charIndex: charIndexRef,
			charLength: charLengthRef,
			sourceOffset: sourceOffsetRef,
			paragraph: currentParagraphIndexRef
		},
		visual: { wordHighlighterRef, scrollFollowerRef, updateWordHighlight, updateMedia3Highlight },
		resume: { saveResumePosition, clearResumePosition },
		state: { playing: setIsPlaying, paused: setIsPaused, loading: setIsLoading, chunk: setCurrentChunkIndex },
		stop: (clearSaved) => stopReading(clearSaved)
	});

	useEffect(() => {
		stopReading();
	}, [paragraphs]);

	useEffect(() => {
		if (ttsEngine === 'vieneu') {
			stopReading();
		}
	}, [vieneuModel, voiceUri, ttsEngine, vieneuOptions]);

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
				edgePlayback.recoverIfPaused();
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
	}, [ttsEngine, synth, edgePlayback]);

	useEffect(() => {
		if (activeNativeStream) return;
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
	}, [activeNativeStream, chunks.length, isLoading, isPaused, isPlaying]);

	useEffect(() => {
		return () => {
			wordHighlighterRef.current?.dispose();
			scrollFollowerRef.current?.cancel();
			stopReading();
		};
	}, []);

	const playChunkViaBrowser = createBrowserSpeechPlayback({
		chunks,
		synth,
		voiceUri,
		speechRateRef,
		isPlayingRef,
		isPausedRef,
		playSessionIdRef,
		currentChunkIdxRef,
		charIndexRef,
		charLengthRef,
		utteranceRef,
		ownsBrowserSpeechQueueRef,
		wordHighlighterRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		stopReading: (clear) => stopReading(clear),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunk: (index, offset) => playChunk(index, offset)
	});

	const playChunkViaVieNeu = createVieNeuPlayback({
		chunks,
		voiceUri,
		speechRate,
		chapterContext,
		paragraphContexts,
		segmentMetadata,
		isPlayingRef,
		playSessionIdRef,
		currentChunkIdxRef,
		gaplessPlayerRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		stopAudioPlayer,
		stopReading: () => stopReading(),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunkViaBrowser: (index, offset, sessionId) => playChunkViaBrowser(index, offset, sessionId),
		vieneuServerUrl,
		vieneuModel,
		vieneuOptions,
		getVieneuOptionsForSegment
	});

	const resumeTransport = () => {
		if (activeNativeStream) {
			void activeNativeStream.resume();
			return;
		}
		if (ttsEngine === 'vieneu' && gaplessPlayerRef.current) {
			void gaplessPlayerRef.current.resume().catch(() => playChunk(currentChunkIdxRef.current));
			return;
		}
		if (ttsEngine === 'browser' && NativeTTSService.isNative()) {
			playChunk(currentChunkIdxRef.current, Math.max(0, charIndexRef.current));
			return;
		}
		if (ttsEngine === 'browser') {
			synth?.resume();
			return;
		}
		if (ttsEngine === 'edge' && edgePlayback.hasAudio()) {
			void edgePlayback.resume().catch(() => playChunk(currentChunkIdxRef.current));
			return;
		}
		playChunk(currentChunkIdxRef.current);
	};

	const startNativePlayback = (targetIdx: number, targetOff: number): boolean => {
		if (!activeNativeStream) return false;
		nativePlaybackActiveRef.current = true;
		setIsPlaying(true);
		setIsLoading(true);
		isPlayingRef.current = true;
		isPausedRef.current = false;
		pendingNativeChunkRef.current = null;
		const textChunks = chunks.map((c) => c.text);
		const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;
		const edgeBufferMode = useReaderConfigStore.getState().edgeBufferMode || 'file';
		const isMedia3Mode = ttsEngine === 'edge' && edgeBufferMode === 'media3';
		const sourceOffset = (chunks[targetIdx]?.startOffset ?? 0) + targetOff;
		const nativeStartIndex = isMedia3Mode ? getMedia3UtteranceIndex(targetIdx, sourceOffset) : targetIdx;
		media3UtteranceIndexRef.current = nativeStartIndex;
		pendingMedia3UtteranceRef.current = null;
		const startCharIndex = Math.max(0, sourceOffset - (media3Utterances[nativeStartIndex]?.sourceStart ?? 0));
		const targetVoice = ttsEngine === 'edge' ? edgeVoiceUri || 'vi-VN-HoaiMyNeural' : voiceUri;

		const bookTitle = chapterContext.bookName || (chapterContext.bookId ? `Truyện #${chapterContext.bookId}` : 'Stories Reader');
		const chapterTitle =
			chapterContext.chapterTitle ||
			(chapterContext.chapterNumber ? `Chương ${chapterContext.chapterNumber}` : chapterContext.chapterId ? `Chương ${chapterContext.chapterId}` : 'Chương đang đọc');

		const common = { chunks: textChunks, startIndex: nativeStartIndex, voice: targetVoice, rate: currentSpeechRate, gatewayUrl: activeDomain?.url || getGatewayBaseUrl(), bookTitle, chapterTitle };
		const playback =
			ttsEngine === 'edge'
				? EdgeTTSNativeStreamService.startPlayback({
						...common,
						pitch: '+0Hz',
						bufferMode: edgeBufferMode,
						...(isMedia3Mode ? { utterances: media3Utterances, startCharIndex, sessionId: `edge-media3-${crypto.randomUUID()}` } : {})
					})
				: NativeTTSStreamService.startPlayback({ ...common, pitch: 1.0, startCharIndex: targetOff });
		void playback;
		return true;
	};

	const startReading = (targetIndex?: number, targetOffset?: number) => {
		if (targetIndex === undefined && isPlayingRef.current && !isPausedRef.current) return;
		scrollFollowerRef.current?.resumeFollowing();
		void requestWakeLock();
		if (isPaused && targetIndex === undefined) {
			setIsPaused(false);
			setIsPlaying(true);
			setIsLoading(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			backgroundAudioRef.current?.start();
			resumeTransport();
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

		const position = resolveReadAloudStart(chunks, currentChunkIdxRef.current, targetIndex === undefined ? getResumePosition() : null, targetIndex, targetOffset);
		let targetIdx = position.index;
		let targetOff = position.offset;

		if (targetIdx >= chunks.length) {
			targetIdx = 0;
			targetOff = 0;
			clearResumePosition();
		}
		currentChunkIdxRef.current = targetIdx;

		const targetChunk = chunks[targetIdx];
		const readerContent = document.querySelector('#main-story-content');
		const pNode = targetChunk ? readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${targetChunk.pIdx}"]`) : null;
		if (typeof pNode?.scrollIntoView === 'function') pNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

		if (startNativePlayback(targetIdx, targetOff)) return;

		playChunk(targetIdx, targetOff);
	};

	const pauseReading = () => {
		scrollFollowerRef.current?.pauseFollowing();
		releaseWakeLock();
		if (currentChunkIdxRef.current < chunks.length) {
			saveResumePosition(
				currentChunkIdxRef.current,
				charIndexRef.current > 0 ? charIndexRef.current : 0,
				currentParagraphIndexRef.current >= 0 ? currentParagraphIndexRef.current : undefined,
				charIndexRef.current >= 0 ? sourceOffsetRef.current : undefined
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
			return;
		}
		if (ttsEngine === 'browser' && NativeTTSService.isNative()) {
			void NativeTTSService.stop();
			return;
		}
		if (ttsEngine === 'browser' && ownsBrowserSpeechQueueRef.current) {
			synth?.pause();
			return;
		}
		if (ttsEngine === 'edge') edgePlayback.pause();
	};

	const navigateMedia3Utterance = (direction: -1 | 1): boolean => {
		if (ttsEngine !== 'edge' || !activeNativeStream || useReaderConfigStore.getState().edgeBufferMode !== 'media3') return false;
		const nativeIndex = media3UtteranceIndexRef.current + direction;
		const utterance = media3Utterances[nativeIndex];
		if (nativeIndex >= media3Utterances.length) clearResumePosition();
		if (!utterance || utterance.sourceChunkIndex === undefined) {
			stopReading(direction === 1);
			return true;
		}
		playSessionIdRef.current += 1;
		stopAudioPlayer();
		media3UtteranceIndexRef.current = nativeIndex;
		pendingMedia3UtteranceRef.current = nativeIndex;
		pendingNativeChunkRef.current = utterance.sourceChunkIndex;
		currentChunkIdxRef.current = utterance.sourceChunkIndex;
		setIsLoading(true);
		setIsPlaying(false);
		setIsPaused(false);
		isPlayingRef.current = true;
		isPausedRef.current = false;
		void activeNativeStream.seekToChunk(nativeIndex);
		return true;
	};

	const navigateSourceChunk = (direction: -1 | 1) => {
		const index = currentChunkIdxRef.current + direction;
		if (index < 0) {
			stopReading();
			return;
		}
		if (index >= chunks.length) {
			clearResumePosition();
			stopReading(true);
			return;
		}
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
		currentChunkIdxRef.current = index;
		if (activeNativeStream) {
			pendingNativeChunkRef.current = index;
			const nativeIndex = ttsEngine === 'edge' && useReaderConfigStore.getState().edgeBufferMode === 'media3' ? getMedia3UtteranceIndex(index) : index;
			void activeNativeStream.seekToChunk(nativeIndex);
			return;
		}
		playChunk(index);
	};

	const navigateReading = (direction: -1 | 1) => {
		scrollFollowerRef.current?.resumeFollowing();
		if (navigateMedia3Utterance(direction)) return;
		navigateSourceChunk(direction);
	};
	const nextSection = () => navigateReading(1);
	const prevSection = () => navigateReading(-1);

	const jumpToContent = (pIdx: number, textOffset: number = 0) => {
		let targetIndex = chunks.findIndex((c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length);
		if (targetIndex === -1) {
			targetIndex = chunks.findIndex((c) => c.pIdx === pIdx);
		}

		if (targetIndex === -1) return;
		const chunkOffset = Math.max(0, textOffset - chunks[targetIndex].startOffset);
		startReading(targetIndex, chunkOffset);
	};
	const locateReadingLine = () => {
		window.getSelection()?.removeAllRanges();
		scrollFollowerRef.current?.locateCurrentLine();
	};

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
