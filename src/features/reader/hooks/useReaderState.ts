import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isEdgeReadAloudActive } from '@/hooks/useEdgeReadAloudBgm';
import { offlineDb } from '@/lib/offlineDb';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { locateActiveReadingElement, resolveLatestReadingChapter } from '../utils/readerHelpers';

import type { useReadAloud } from '@/hooks/useReadAloud';
import type { ChapterContent, ChapterDetailItem } from '@/shared/types';
import type React from 'react';

export function useReaderConfig() {
	const font = useReaderConfigStore((state) => state.font);
	const fontSize = useReaderConfigStore((state) => state.fontSize);
	const lineHeight = useReaderConfigStore((state) => state.lineHeight);
	const groupLines = useReaderConfigStore((state) => state.groupLines);
	const batchChapterSize = useReaderConfigStore((state) => state.batchChapterSize || 1);
	const isEnabledReplace = useReaderConfigStore((state) => state.isEnabledReplace);
	const showTTSControlOnReader = useReaderConfigStore((state) => state.showTTSControlOnReader ?? true);
	const bgmEnabled = useReaderConfigStore((state) => state.bgmEnabled ?? true);
	const bgmVolume = useReaderConfigStore((state) => state.bgmVolume ?? 0.2);
	const bgmAudioUrl = useReaderConfigStore((state) => state.bgmAudioUrl || '/audio/ambient-bgm.mp3');
	const bgmFadeInMs = useReaderConfigStore((state) => state.bgmFadeInMs ?? 500);
	const bgmFadeOutMs = useReaderConfigStore((state) => state.bgmFadeOutMs ?? 800);
	const bgmStopDelayMs = useReaderConfigStore((state) => state.bgmStopDelayMs ?? 1500);
	const isBgmPreviewing = useReaderConfigStore((state) => state.isBgmPreviewing ?? false);

	return {
		font,
		fontSize,
		lineHeight,
		groupLines,
		batchChapterSize,
		isEnabledReplace,
		showTTSControlOnReader,
		bgmEnabled,
		bgmVolume,
		bgmAudioUrl,
		bgmFadeInMs,
		bgmFadeOutMs,
		bgmStopDelayMs,
		isBgmPreviewing,
	};
}

export function useEdgeReadAloudDetector(): boolean {
	const [hasEdgeReadAloud, setHasEdgeReadAloud] = useState(false);

	useEffect(() => {
		if (typeof document === 'undefined') return;

		const check = () => {
			setHasEdgeReadAloud(isEdgeReadAloudActive());
		};

		check();

		const observer = new MutationObserver(check);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	return hasEdgeReadAloud;
}

interface UseActiveChapterObserverProps {
	bookId?: string;
	displayChapters: ChapterDetailItem[];
}

export function useActiveChapterObserver({ bookId, displayChapters }: UseActiveChapterObserverProps) {
	const [activeChapter, setActiveChapter] = useState<{
		chapterId: string;
		chapterNumber: number;
		title: string;
	} | null>(null);

	useEffect(() => {
		if (displayChapters.length > 0) {
			setActiveChapter({
				chapterId: displayChapters[0].chapterId,
				chapterNumber: displayChapters[0].chapterNumber,
				title: displayChapters[0].title,
			});
			return;
		}
		setActiveChapter(null);
	}, [displayChapters]);

	useEffect(() => {
		if (displayChapters.length <= 1) return;
		if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

		const handleIntersection: IntersectionObserverCallback = (entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const chapId = entry.target.getAttribute('data-chapter-id');
				const chapNum = Number(entry.target.getAttribute('data-chapter-number'));
				const chapTitle = entry.target.getAttribute('data-chapter-title') || '';
				if (chapId) {
					setActiveChapter({
						chapterId: chapId,
						chapterNumber: chapNum,
						title: chapTitle,
					});
				}
			}
		};

		const observer = new IntersectionObserver(handleIntersection, {
			rootMargin: '-10% 0px -70% 0px',
			threshold: [0, 0.2, 0.5],
		});

		const chapterBlocks = document.querySelectorAll('.chapter-block-section');
		chapterBlocks.forEach((el) => observer.observe(el));

		return () => {
			chapterBlocks.forEach((el) => observer.unobserve(el));
			observer.disconnect();
		};
	}, [displayChapters]);

	const syncLastReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!activeChapter || !bookId) return;

		offlineDb.getBook(bookId).then((b) => {
			if (!b) return;
			b.lastReadChapter = {
				chapterId: activeChapter.chapterId,
				chapterNumber: activeChapter.chapterNumber,
				title: activeChapter.title,
			};
			b.lastedReadAt = new Date().toISOString();
			offlineDb.saveBook(b);
		});

		if (syncLastReadTimerRef.current) {
			clearTimeout(syncLastReadTimerRef.current);
		}

		syncLastReadTimerRef.current = setTimeout(() => {
			BookRepository.updateLastReadChapter(bookId, {
				chapterId: activeChapter.chapterId,
				chapterNumber: activeChapter.chapterNumber,
				title: activeChapter.title,
			});
		}, 800);

		return () => {
			if (syncLastReadTimerRef.current) {
				clearTimeout(syncLastReadTimerRef.current);
			}
		};
	}, [activeChapter, bookId]);

	return activeChapter;
}

function fetchChapterContent(chapterId: string, groupLines: number, isEnabledReplace: boolean, batchSize: number, isForceFresh: boolean) {
	if (isForceFresh) {
		return ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', batchSize, { forceFresh: true });
	}
	return ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', batchSize);
}

export function useChapterLoader(chapterId: string | undefined, config: ReturnType<typeof useReaderConfig>) {
	const [contentData, setContentData] = useState<ChapterContent | null>(null);
	const [loading, setLoading] = useState(true);
	const [domResetKey, setDomResetKey] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const forceFreshNextLoadRef = useRef(false);

	const loadChapter = useCallback(
		async (isForceFresh = false) => {
			if (!chapterId) return;
			setLoading(true);
			setError(null);
			try {
				const effectiveBatchSize = config.batchChapterSize;
				const res = await fetchChapterContent(chapterId, config.groupLines, config.isEnabledReplace, effectiveBatchSize, isForceFresh);

				setDomResetKey((k) => k + 1);
				setContentData(res);
				if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
					window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
				}
			} catch (e: unknown) {
				const message = e instanceof Error ? e.message : 'Lỗi khi tải nội dung chương';
				setError(message);
			} finally {
				setLoading(false);
			}
		},
		[chapterId, config.groupLines, config.isEnabledReplace, config.batchChapterSize]
	);

	useEffect(() => {
		const shouldForceFresh = forceFreshNextLoadRef.current;
		forceFreshNextLoadRef.current = false;
		loadChapter(shouldForceFresh);
	}, [chapterId, loadChapter]);

	return {
		contentData,
		loading,
		domResetKey,
		error,
		forceFreshNextLoadRef,
		loadChapter,
	};
}

export function useReaderSheets() {
	const [showTypographySheet, setShowTypographySheet] = useState(false);
	const [showChapterSelectSheet, setShowChapterSelectSheet] = useState(false);
	const [showHistorySheet, setShowHistorySheet] = useState(false);

	const handleOpenHistory = useCallback(() => setShowHistorySheet(true), []);
	const handleOpenChapterSelect = useCallback(() => setShowChapterSelectSheet(true), []);
	const handleCloseHistory = useCallback(() => setShowHistorySheet(false), []);
	const handleCloseChapterSelect = useCallback(() => setShowChapterSelectSheet(false), []);
	const handleCloseTypography = useCallback(() => setShowTypographySheet(false), []);

	return {
		showTypographySheet,
		showChapterSelectSheet,
		showHistorySheet,
		handleOpenHistory,
		handleOpenChapterSelect,
		handleCloseHistory,
		handleCloseChapterSelect,
		handleCloseTypography,
	};
}

interface UseTitleBarActionsProps {
	bookId?: string;
	chapterId?: string;
	activeChapterId?: string;
	isRefreshingLatest: boolean;
	setIsRefreshingLatest: (val: boolean) => void;
	tts: ReturnType<typeof useReadAloud>;
	handleStopTTS: () => void;
	loadChapter: (forceFresh?: boolean) => Promise<void>;
	forceFreshNextLoadRef: React.MutableRefObject<boolean>;
}

export function useTitleBarActions({
	bookId,
	chapterId,
	activeChapterId,
	isRefreshingLatest,
	setIsRefreshingLatest,
	tts,
	handleStopTTS,
	loadChapter,
	forceFreshNextLoadRef,
}: UseTitleBarActionsProps) {
	const navigate = useNavigate();

	const handleTitleSingleClick = useCallback(() => {
		if (hasNativeReaderGestures() && tts.isTTSActive) {
			tts.locateReadingLine();
			return;
		}
		locateActiveReadingElement(tts.activeParagraphIndex, tts.isPlaying || tts.isPaused);
	}, [tts]);

	const handleTitleDoubleClick = useCallback(async () => {
		if (!bookId || isRefreshingLatest) return;
		setIsRefreshingLatest(true);
		handleStopTTS();
		try {
			const targetChapter = await resolveLatestReadingChapter(bookId);
			const targetChapId = targetChapter?.chapterId || activeChapterId || chapterId;
			if (!targetChapId) return;

			if (targetChapId === chapterId) {
				await loadChapter(true);
				return;
			}
			forceFreshNextLoadRef.current = true;
			navigate(`/book/${bookId}/chapter/${targetChapId}`);
		} catch (err: unknown) {
			console.error('Lỗi khi tải lại chương:', err);
		} finally {
			setIsRefreshingLatest(false);
		}
	}, [
		bookId,
		chapterId,
		activeChapterId,
		isRefreshingLatest,
		handleStopTTS,
		loadChapter,
		navigate,
		forceFreshNextLoadRef,
		setIsRefreshingLatest,
	]);

	return { handleTitleSingleClick, handleTitleDoubleClick };
}
