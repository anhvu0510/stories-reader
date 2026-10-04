import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { getGatewayBaseUrl } from '@/services/edgeTtsService';
import { splitByDatabaseBoundaries, type SentenceChunk } from '@/services/gaplessTtsPlayer';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import type { ReadAloudChapterContext } from './useReadAloud';

const WORD_HIGHLIGHT_CLASS = 'stories-tts-word-highlight';

export interface UseNativeReadAloudResult {
	isPlaying: boolean;
	isPaused: boolean;
	isLoading: boolean;
	isTTSActive: boolean;
	currentChunkIndex: number;
	activeParagraphIndex: number;
	startReading: () => void;
	pauseReading: () => void;
	stopReading: (clearPosition?: boolean) => void;
	nextSection: () => void;
	prevSection: () => void;
	jumpToContent: (pIdx: number, textOffset?: number) => void;
	clearResumePosition: () => void;
}

/**
 * Hook chuyên biệt, siêu nhẹ dành riêng cho môi trường Native Android (Capacitor).
 *
 * Tính năng chính:
 * 1. Không khởi tạo WebAudioContext, Web SpeechSynthesis, hay VieNeu buffer trên JS thread,
 *    giúp tiết kiệm RAM và loại bỏ hoàn toàn nguy cơ rò rỉ bộ nhớ.
 * 2. Kết nối trực tiếp với Native Streaming Player (EdgeTTS / Device TTS) dưới tầng Android Kotlin/Java.
 * 3. Hỗ trợ hiển thị thanh điều khiển Audio Media chuẩn trên thanh thông báo (Notification)
 *    và Màn hình khóa (Lock Screen) nhờ Android Foreground Service & MediaSession.
 * 4. Tô sáng từ (word highlight) mượt mà 25ms, chuyển câu gối đầu gapless 0ms không bị chớp giật trắng (flicker).
 */
export function useNativeReadAloud(
	paragraphs: string[],
	chapterContext: ReadAloudChapterContext = {},
	paragraphContexts: ReadAloudChapterContext[] = []
): UseNativeReadAloudResult {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const voiceUri = useReaderConfigStore((state) => state.voiceUri);
	const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
	const speechRate = useReaderConfigStore((state) => state.speechRate);
	const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');

	// State phát âm thanh
	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);

	// Quản lý highlight từ và tự động cuộn trang theo câu
	const wordHighlighterRef = useRef<DomWordHighlighter | null>(null);
	if (!wordHighlighterRef.current) {
		wordHighlighterRef.current = new DomWordHighlighter(WORD_HIGHLIGHT_CLASS);
	}
	const scrollFollowerRef = useRef<ReadAloudScrollFollower | null>(null);
	if (!scrollFollowerRef.current) {
		scrollFollowerRef.current = new ReadAloudScrollFollower();
	}

	const chapterId = chapterContext?.chapterId;

	// Lưu và khôi phục vị trí đọc dở trong chương (Resume Position)
	const getResumePosition = useCallback((): { chunkIndex: number; charOffset: number } | null => {
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
		(chunkIndex: number, charOffset: number) => {
			if (!chapterId || typeof window === 'undefined') return;
			try {
				localStorage.setItem(`stories_tts_pos_${chapterId}`, JSON.stringify({ chunkIndex, charOffset }));
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

	// Dọn dẹp các cache vị trí của các chương cũ
	const clearAllStaleResumePositions = useCallback((currentChapId?: string) => {
		if (typeof window === 'undefined') return;
		try {
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				if (key && key.startsWith('stories_tts_pos_')) {
					if (!currentChapId || key !== `stories_tts_pos_${currentChapId}`) {
						localStorage.removeItem(key);
					}
				}
			}
		} catch {}
	}, []);

	useEffect(() => {
		clearAllStaleResumePositions(chapterId);
	}, [chapterId, clearAllStaleResumePositions]);

	// Tách các đoạn văn thành danh sách câu hoàn chỉnh (Sentence Chunks)
	const chunks = useMemo(() => {
		const res: SentenceChunk[] = [];
		paragraphs.forEach((html, pIdx) => {
			if (!html) return;
			const tmp = document.createElement('div');
			tmp.innerHTML = html;
			const text = tmp.textContent || tmp.innerText || '';

			if (text.trim()) {
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

	const currentChunkIdxRef = useRef<number>(0);
	const isPlayingRef = useRef(false);
	const isPausedRef = useRef(false);
	const charIndexRef = useRef(-1);
	const charLengthRef = useRef(0);

	const activeParagraphIndex = currentChunkIndex >= 0 && chunks[currentChunkIndex] ? chunks[currentChunkIndex].pIdx : -1;

	// Đồng bộ trạng thái sang useTTSStore toàn cục
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

	// Lựa chọn luồng stream native phù hợp (Edge TTS hoặc Thiết bị Native TTS)
	const activeNativeStream = useMemo(() => {
		if (ttsEngine === 'edge' && EdgeTTSNativeStreamService.isAvailable()) {
			return EdgeTTSNativeStreamService;
		}
		if (ttsEngine === 'browser' && NativeTTSStreamService.isAvailable()) {
			return NativeTTSStreamService;
		}
		// Dự phòng: nếu engine là edge hoặc vieneu trên Android native, ưu tiên EdgeTTSNativeStream
		if (EdgeTTSNativeStreamService.isAvailable()) {
			return EdgeTTSNativeStreamService;
		}
		if (NativeTTSStreamService.isAvailable()) {
			return NativeTTSStreamService;
		}
		return null;
	}, [ttsEngine]);

	// Đăng ký các sự kiện phát từ Android Native Plugin lên giao diện React
	useEffect(() => {
		if (!activeNativeStream) return;

		// Khi một câu mới bắt đầu phát:
		// Tuyệt đối không xóa highlight ngay lập tức để tránh hiện tượng nháy trắng (flicker) giữa các câu gối đầu
		const unsubChunk = activeNativeStream.onChunkStart((idx) => {
			currentChunkIdxRef.current = idx;
			setCurrentChunkIndex(idx);
			setIsLoading(false);
			setIsPlaying(true);
			setIsPaused(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			// Lưu lại vị trí câu đang phát để khôi phục khi mở lại
			saveResumePosition(idx, 0);
		});

		// Khi có sự kiện vị trí từ chính xác (Word Boundary) từ bộ đếm 25ms dưới native:
		const unsubWord = activeNativeStream.onWordBoundary(({ chunkIndex, charIndex, charLength }) => {
			charIndexRef.current = charIndex;
			charLengthRef.current = charLength;
			const chunk = chunks[chunkIndex];
			if (chunk) {
				const paragraphEl = document.querySelector(`[data-paragraph-index="${chunk.pIdx}"]`) as HTMLElement | null;
				if (paragraphEl) {
					const rects = wordHighlighterRef.current?.highlight(
						paragraphEl,
						chunk.startOffset + charIndex,
						charLength,
						chunk.startOffset,
						chunk.length
					);
					if (rects?.line) {
						scrollFollowerRef.current?.follow(rects.line);
					}
				}
			}
		});

		// Tạm dừng auto-scroll khi người dùng tương tác cuộn / chạm màn hình
		const onUserScroll = () => {
			scrollFollowerRef.current?.notifyUserInteraction();
		};
		window.addEventListener('wheel', onUserScroll, { passive: true });
		window.addEventListener('touchmove', onUserScroll, { passive: true });
		window.addEventListener('pointerdown', onUserScroll, { passive: true });

		// Cập nhật trạng thái Play / Pause / Buffering từ Native:
		const unsubState = activeNativeStream.onPlaybackStateChange(({ isPlaying: p, isPaused: pa, isBuffering: b }) => {
			setIsPlaying(p);
			setIsPaused(pa);
			setIsLoading(b);
			isPlayingRef.current = p;
			isPausedRef.current = pa;
		});

		// Khi hoàn tất toàn bộ chương:
		const unsubDone = activeNativeStream.onPlaybackComplete(() => {
			setIsPlaying(false);
			setIsPaused(false);
			setIsLoading(false);
			isPlayingRef.current = false;
			isPausedRef.current = false;
			setCurrentChunkIndex(-1);
			wordHighlighterRef.current?.clear();
			clearResumePosition();
		});

		return () => {
			unsubChunk();
			unsubWord();
			unsubState();
			unsubDone();
			window.removeEventListener('wheel', onUserScroll);
			window.removeEventListener('touchmove', onUserScroll);
			window.removeEventListener('pointerdown', onUserScroll);
		};
	}, [activeNativeStream, chunks, saveResumePosition, clearResumePosition]);

	// Hủy highlight khi unmount hook
	useEffect(() => {
		return () => {
			wordHighlighterRef.current?.clear();
		};
	}, []);

	// Các phương thức điều khiển phát âm thanh
	const startReading = useCallback(() => {
		if (chunks.length === 0 || !activeNativeStream) return;

		// Nếu đang tạm dừng thì chỉ cần tiếp tục
		if (isPausedRef.current) {
			void activeNativeStream.resume();
			setIsPaused(false);
			setIsPlaying(true);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			return;
		}

		// Xác định vị trí bắt đầu (từ resume position hoặc từ đầu chương)
		const savedPos = getResumePosition();
		const startIdx = savedPos && savedPos.chunkIndex < chunks.length ? savedPos.chunkIndex : 0;

		setIsLoading(true);
		setIsPlaying(false);
		setIsPaused(false);
		isPlayingRef.current = true;
		isPausedRef.current = false;
		currentChunkIdxRef.current = startIdx;
		setCurrentChunkIndex(startIdx);

		// Trích xuất metadata sách và chương để hiển thị lên Notification & Lock Screen
		const bookTitle = chapterContext.bookName || (chapterContext.bookId ? `Truyện #${chapterContext.bookId}` : 'Stories Reader');
		const chapterTitle = chapterContext.chapterTitle
			|| (chapterContext.chapterNumber
				? `Chương ${chapterContext.chapterNumber}`
				: chapterContext.chapterId
					? `Chương ${chapterContext.chapterId}`
					: 'Chương đang đọc');

		const rawChunks = chunks.map((c) => c.text);
		void activeNativeStream.startPlayback({
			chunks: rawChunks,
			startIndex: startIdx,
			voice: ttsEngine === 'edge' ? edgeVoiceUri : voiceUri,
			rate: speechRate,
			gatewayUrl: activeDomain?.url || getGatewayBaseUrl(),
			bookTitle,
			chapterTitle
		});
	}, [activeNativeStream, chunks, getResumePosition, isPausedRef, chapterContext, ttsEngine, edgeVoiceUri, voiceUri, speechRate, activeDomain]);

	const pauseReading = useCallback(() => {
		if (activeNativeStream) {
			void activeNativeStream.pause();
		}
		setIsPlaying(false);
		setIsPaused(true);
		isPlayingRef.current = false;
		isPausedRef.current = true;
	}, [activeNativeStream]);

	const stopReading = useCallback(
		(clearPosition = false) => {
			// Kiểm tra xem trước đó TTS có đang chạy, tạm dừng hoặc đang tải không
			const wasActive = isPlayingRef.current || isPausedRef.current || isLoading;

			if (wasActive && activeNativeStream) {
				void activeNativeStream.stop();
			}
			setIsPlaying(false);
			setIsPaused(false);
			setIsLoading(false);
			isPlayingRef.current = false;
			isPausedRef.current = false;
			wordHighlighterRef.current?.clear();

			if (clearPosition) {
				clearResumePosition();
				setCurrentChunkIndex(-1);
			} else if (wasActive) {
				saveResumePosition(currentChunkIdxRef.current, 0);
			}
		},
		[activeNativeStream, clearResumePosition, saveResumePosition, isLoading]
	);

	const nextSection = useCallback(() => {
		if (!activeNativeStream) return;
		const nextIdx = currentChunkIdxRef.current + 1;
		if (nextIdx < chunks.length) {
			setIsLoading(true);
			setIsPlaying(false);
			setIsPaused(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			currentChunkIdxRef.current = nextIdx;
			void activeNativeStream.seekToChunk(nextIdx);
		} else {
			clearResumePosition();
			stopReading(true);
		}
	}, [activeNativeStream, chunks.length, clearResumePosition, stopReading]);

	const prevSection = useCallback(() => {
		if (!activeNativeStream) return;
		if (currentChunkIdxRef.current > 0) {
			const prevIdx = currentChunkIdxRef.current - 1;
			setIsLoading(true);
			setIsPlaying(false);
			setIsPaused(false);
			isPlayingRef.current = true;
			isPausedRef.current = false;
			currentChunkIdxRef.current = prevIdx;
			void activeNativeStream.seekToChunk(prevIdx);
		} else {
			stopReading(false);
		}
	}, [activeNativeStream, stopReading]);

	const jumpToContent = useCallback(
		(pIdx: number, textOffset: number = 0) => {
			if (!activeNativeStream) return;
			let targetIndex = chunks.findIndex(
				(c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length
			);
			if (targetIndex === -1) {
				targetIndex = chunks.findIndex((c) => c.pIdx === pIdx);
			}

			if (targetIndex !== -1) {
				setIsLoading(true);
				setIsPlaying(false);
				setIsPaused(false);
				isPlayingRef.current = true;
				isPausedRef.current = false;
				currentChunkIdxRef.current = targetIndex;
				void activeNativeStream.seekToChunk(targetIndex);
			}
		},
		[activeNativeStream, chunks]
	);

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
		clearResumePosition
	};
}
