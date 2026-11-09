import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEdgeReadAloudBgm } from '@/hooks/useEdgeReadAloudBgm';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useReadAloud } from '@/hooks/useReadAloud';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { openNextChapter, openPrevChapter } from '@/shared/utils/openChapter';
import { useToastStore } from '@/stores/useToastStore';

import {
	applySettledDragTransform,
	buildChapterTarget,
	type buildParagraphChapterContexts,
	computeDragOffset,
	getSwipeCommitThreshold,
	hasTextSelection,
	isTouchMoved,
	resolvePendingTitleHint,
} from '../utils/readerHelpers';

import type { useReaderConfig } from './useReaderState';
import type { ChapterContent, ChapterDetailItem } from '@/shared/types';
import type React from 'react';

export function useZenControls() {
	const [showZenControls, setShowZenControls] = useState(true);
	const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
	const lastTapTimeRef = useRef<number>(0);
	const lastToggleTimeRef = useRef<number>(0);
	const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
	const rippleTimerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (rippleTimerRef.current) {
				clearTimeout(rippleTimerRef.current);
			}
		};
	}, []);

	const toggleZenControls = useCallback((coords?: { x: number; y: number }) => {
		const now = Date.now();
		if (now - lastToggleTimeRef.current < 400) return;
		lastToggleTimeRef.current = now;
		triggerHaptic('light');
		if (coords) {
			setRipple({ x: coords.x, y: coords.y, id: now });
			if (rippleTimerRef.current) {
				clearTimeout(rippleTimerRef.current);
			}
			rippleTimerRef.current = setTimeout(() => {
				setRipple(null);
				rippleTimerRef.current = null;
			}, 350);
		}
		setShowZenControls((prev) => !prev);
	}, []);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches && e.touches.length > 0) {
			touchStartPosRef.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
			};
		}
	}, []);

	const handleTouchEnd = useCallback(
		(e?: React.TouchEvent) => {
			if (hasTextSelection()) {
				touchStartPosRef.current = null;
				return;
			}

			const savedPos = touchStartPosRef.current;
			touchStartPosRef.current = null;

			const firstTouch = e?.changedTouches?.[0];
			if (isTouchMoved(firstTouch, savedPos)) {
				lastTapTimeRef.current = 0;
				return;
			}

			const now = Date.now();
			const timeDiff = now - lastTapTimeRef.current;
			const isDoubleTap = timeDiff < 350 && timeDiff > 40;

			if (!isDoubleTap) {
				lastTapTimeRef.current = now;
				return;
			}

			if (e && typeof e.stopPropagation === 'function') {
				e.stopPropagation();
			}
			const coords = savedPos ? { x: savedPos.x, y: savedPos.y } : undefined;
			toggleZenControls(coords);
			lastTapTimeRef.current = 0;
		},
		[toggleZenControls]
	);

	const handleDoubleClick = useCallback(
		(e?: React.MouseEvent) => {
			if (hasTextSelection()) return;
			if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
			const coords = e ? { x: e.clientX, y: e.clientY } : undefined;
			toggleZenControls(coords);
		},
		[toggleZenControls]
	);

	return {
		showZenControls,
		setShowZenControls,
		ripple,
		setRipple,
		handleTouchStart,
		handleTouchEnd,
		handleDoubleClick,
	};
}

function navigateNextIfAvailable(bookId?: string, chapterId?: string, nextChapterId?: string, onSwipe?: () => void) {
	if (!bookId || !nextChapterId) return;
	onSwipe?.();
	triggerHaptic('medium');
	if (typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}
	openNextChapter(bookId, chapterId, nextChapterId);
}

function navigatePrevIfAvailable(
	bookId?: string,
	chapterId?: string,
	prevChapterId?: string,
	navigateHome?: () => void,
	onSwipe?: () => void
) {
	if (!bookId || !prevChapterId) {
		triggerHaptic('light');
		navigateHome?.();
		return;
	}
	onSwipe?.();
	triggerHaptic('medium');
	if (typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}
	openPrevChapter(bookId, chapterId, prevChapterId);
}

function resetSwipeState(contentEl: HTMLDivElement | null) {
	if (contentEl) {
		contentEl.style.transition = 'none';
		contentEl.style.transform = 'translate3d(0px, 0, 0)';
	}
	if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}
}

function computeDragMoveOffset(offset: number, navigation: ChapterContent['navigation'] | undefined): number {
	const hasPrev = Boolean(navigation?.prev?.chapterId);
	const hasNext = Boolean(navigation?.next?.chapterId);
	return computeDragOffset(offset, hasPrev, hasNext);
}

function resolveDragDirection(offset: number): 'left' | 'right' | null {
	if (offset < 0) return 'left';
	if (offset > 0) return 'right';
	return null;
}

function isSwipeDisabled(loading: boolean, isRefreshing: boolean): boolean {
	return loading || isRefreshing;
}

interface UseReaderSwipeProps {
	bookId?: string;
	chapterId?: string;
	contentData: ChapterContent | null;
	loading: boolean;
	isRefreshingLatest: boolean;
}

export function useReaderSwipeNavigation({ bookId, chapterId, contentData, loading, isRefreshingLatest }: UseReaderSwipeProps) {
	const navigate = useNavigate();
	const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);
	const dragDirectionRef = useRef<'left' | 'right' | null>(null);
	const readerContentRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setSwipeDirection(null);
		setIsDragging(false);
		setDragDirection(null);
		dragDirectionRef.current = null;
		resetSwipeState(readerContentRef.current);
	}, [chapterId]);

	const nav = contentData?.navigation;
	const nextChapterId = nav?.next?.chapterId;
	const prevChapterId = nav?.prev?.chapterId;

	const handleSwipeNext = useCallback(() => {
		navigateNextIfAvailable(bookId, chapterId, nextChapterId, () => setSwipeDirection('left'));
	}, [bookId, chapterId, nextChapterId]);

	const handleSwipePrev = useCallback(() => {
		navigatePrevIfAvailable(
			bookId,
			chapterId,
			prevChapterId,
			() => navigate('/'),
			() => setSwipeDirection('right')
		);
	}, [bookId, chapterId, prevChapterId, navigate]);

	const handleDragStart = useCallback(() => {
		if (readerContentRef.current) {
			readerContentRef.current.style.transition = 'none';
		}
		setIsDragging(true);
	}, []);

	const handleDragMove = useCallback(
		(offset: number) => {
			const contentEl = readerContentRef.current;
			if (!contentEl) return;
			const effectiveOffset = computeDragMoveOffset(offset, contentData?.navigation);
			contentEl.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
			const nextDirection = resolveDragDirection(effectiveOffset);
			if (nextDirection === dragDirectionRef.current) return;
			dragDirectionRef.current = nextDirection;
			setDragDirection(nextDirection);
		},
		[contentData?.navigation]
	);

	const handleDragEnd = useCallback((settled?: 'left' | 'right' | 'cancel') => {
		setIsDragging(false);
		dragDirectionRef.current = null;
		setDragDirection(null);
		applySettledDragTransform(readerContentRef.current, settled);
	}, []);

	const pendingTitleHint = useMemo(
		() => resolvePendingTitleHint(swipeDirection ?? dragDirection, 0, contentData?.navigation),
		[swipeDirection, dragDirection, contentData?.navigation]
	);

	const commitThreshold = getSwipeCommitThreshold();
	const swipeDisabled = isSwipeDisabled(loading, isRefreshingLatest);

	useSwipeGesture({
		onSwipeLeft: handleSwipeNext,
		onSwipeRight: handleSwipePrev,
		onDragStart: handleDragStart,
		onDragMove: handleDragMove,
		onDragEnd: handleDragEnd,
		threshold: commitThreshold,
		minVelocity: 0.45,
		disabled: swipeDisabled,
	});

	return {
		readerContentRef,
		isDragging,
		pendingTitleHint,
	};
}

interface UseReaderAudioProps {
	bookId?: string;
	chapterId?: string;
	contentData: ChapterContent | null;
	displayChapters: ChapterDetailItem[];
	allParagraphs: string[];
	paragraphChapterContexts: ReturnType<typeof buildParagraphChapterContexts>;
	config: ReturnType<typeof useReaderConfig>;
}

export function useReaderAudioService({
	bookId,
	chapterId,
	contentData,
	displayChapters,
	allParagraphs,
	paragraphChapterContexts,
	config,
}: UseReaderAudioProps) {
	const showToast = useToastStore((state) => state.showToast);
	const firstChap = displayChapters[0];
	const chapterTarget = useMemo(
		() => buildChapterTarget(firstChap, bookId, chapterId, contentData?.chapter),
		[firstChap, bookId, chapterId, contentData?.chapter]
	);

	const tts = useReadAloud(allParagraphs, chapterTarget, paragraphChapterContexts);

	const bgm = useEdgeReadAloudBgm({
		audioUrl: config.bgmAudioUrl,
		volume: config.bgmVolume,
		fadeInMs: config.bgmFadeInMs,
		fadeOutMs: config.bgmFadeOutMs,
		stopDelayMs: config.bgmStopDelayMs,
		enabled: config.bgmEnabled,
		isBgmPreviewing: config.isBgmPreviewing,
		isTTSActive: tts.isTTSActive && tts.isPlaying,
	});

	const handleStopTTS = useCallback(() => {
		tts.stopReading();
		bgm.stopBgm(true);
	}, [tts, bgm]);

	const handleToggleBgm = useCallback(() => {
		bgm.toggleBgm();
		const willPlay = !bgm.isPlaying;
		showToast(willPlay ? 'Đã bật nhạc nền thư giãn' : 'Đã tắt nhạc nền', 'info');
	}, [bgm, showToast]);

	return {
		tts,
		bgm,
		handleStopTTS,
		handleToggleBgm,
	};
}
