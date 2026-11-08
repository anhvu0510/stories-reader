import { Capacitor } from '@capacitor/core';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PullToRefresh } from '@/components/PullToRefresh';
import { TranslationSheet } from '@/components/TranslationSheet';
import { GlobalSettingsSheet } from '@/features/settings/GlobalSettingsSheet';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isEdgeReadAloudActive, useEdgeReadAloudBgm } from '@/hooks/useEdgeReadAloudBgm';
import { useGlobalLoading } from '@/hooks/useGlobalLoading';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useReadAloud } from '@/hooks/useReadAloud';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { offlineDb } from '@/lib/offlineDb';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { clearAllCaches } from '@/shared/utils/cacheUtils';
import { openNextChapter, openPrevChapter } from '@/shared/utils/openChapter';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { ParagraphView } from './components/ParagraphView';
import { QuickBookHistorySheet } from './components/QuickBookHistorySheet';
import { QuickChapterSelectSheet } from './components/QuickChapterSelectSheet';
import { QuickTypographySheet } from './components/QuickTypographySheet';
import { ReaderChapterSkeleton } from './components/ReaderChapterSkeleton';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderQuickControl } from './components/ReaderQuickControl';
import { SelectionSpeakerTooltip } from './components/SelectionSpeakerTooltip';
import { VerticalBatchChapterNav } from './components/VerticalBatchChapterNav';

import type { ChapterContent, ChapterDetailItem } from '@/shared/types';

interface ChapterContentSectionProps {
	chapters: ChapterDetailItem[];
	fontSize: number;
	lineHeight: number;
	isPlaying: boolean;
	isPaused: boolean;
	currentParagraphIndex: number;
	onDoubleClick: (e: React.MouseEvent) => void;
	onTouchStart?: (e: React.TouchEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

interface ChapterParagraphsProps {
	chapterId: string;
	content: string[];
	offset: number;
	fontSize: number;
	lineHeight: number;
	isPlaying: boolean;
	isPaused: boolean;
	currentParagraphIndex: number;
	onDoubleClick?: (e: React.MouseEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

function ChapterParagraphs({
	chapterId,
	content,
	offset,
	fontSize,
	lineHeight,
	isPlaying,
	isPaused,
	currentParagraphIndex,
	onDoubleClick,
	onTouchEnd,
}: ChapterParagraphsProps) {
	const items = useMemo(
		() =>
			content.map((paragraphHtml, index) => ({
				id: `${chapterId}-p-${offset + index}`,
				index: offset + index,
				content: paragraphHtml,
			})),
		[chapterId, content, offset]
	);

	return (
		<article className="px-4 select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
			{items.map((item) => {
				const isTTSActive = (isPlaying || isPaused) && currentParagraphIndex === item.index;
				return (
					<ParagraphView
						key={item.id}
						index={item.index}
						content={item.content}
						isTTSActive={isTTSActive}
						onDoubleClick={onDoubleClick}
						onTouchEnd={onTouchEnd}
					/>
				);
			})}
		</article>
	);
}

// 100% Frozen & Memoized Multi-Chapter Content Section
const ChapterContentSection = memo(function ChapterContentSection({
	chapters,
	fontSize,
	lineHeight,
	isPlaying,
	isPaused,
	currentParagraphIndex,
	onDoubleClick,
	onTouchStart,
	onTouchEnd,
}: ChapterContentSectionProps) {
	const paragraphOffsets = useMemo(
		() => chapters.map((_, chapterIndex) => chapters.slice(0, chapterIndex).reduce((total, chapter) => total + chapter.content.length, 0)),
		[chapters]
	);

	return (
		<main
			id="main-story-content"
			onDoubleClick={onDoubleClick}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			className="pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] sm:pt-24 pb-24 select-text relative z-10"
		>
			{chapters.map((chap, chapIdx) => {
				const chapterTitleText = chap.title?.toLowerCase().startsWith('chương')
					? chap.title
					: `Chương ${chap.chapterNumber}: ${chap.title}`;
				return (
					<section
						key={chap.chapterId || `chap-${chap.chapterNumber}`}
						id={`chapter-section-${chap.chapterId}`}
						data-chapter-id={chap.chapterId}
						data-chapter-number={chap.chapterNumber}
						data-chapter-title={chap.title}
						className="chapter-block-section scroll-mt-16 mb-0"
					>
						{/* Subtle 3D Glowing Glass Divider between chapters in batch */}
						{chapIdx > 0 && (
							<div className="mt-8 mb-6 px-6 flex items-center gap-3 select-none">
								<div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent" />
								<div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.8)] border border-white/40" />
								<div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent" />
							</div>
						)}

						{/* Chapter Section Title with Accent Indicator */}
						<div className="px-4 mb-3 pt-0.5">
							<h2 className="text-base sm:text-lg font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2">
								<span className="w-1 h-4 rounded-full bg-primary inline-block shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
								<p>{chapterTitleText}</p>
							</h2>
						</div>

						{/* Chapter Paragraphs */}
						<ChapterParagraphs
							chapterId={chap.chapterId}
							content={chap.content}
							offset={paragraphOffsets[chapIdx]}
							fontSize={fontSize}
							lineHeight={lineHeight}
							isPlaying={isPlaying}
							isPaused={isPaused}
							currentParagraphIndex={currentParagraphIndex}
							onDoubleClick={onDoubleClick}
							onTouchEnd={onTouchEnd}
						/>
					</section>
				);
			})}
		</main>
	);
});

const FONT_STYLE_MAP: Record<string, string> = {
	bookerly: 'font-bookerly',
	merriweather: 'font-merriweather',
	lora: 'font-lora',
	charter: 'font-charter',
	palatino: 'font-palatino',
	font_viet_tay: 'font-viet-tay',
};

function getFontClass(font: string): string {
	return FONT_STYLE_MAP[font] || 'font-default';
}

function computeDisplayChapters(contentData: ChapterContent | null): ChapterDetailItem[] {
	if (contentData?.chapters && contentData.chapters.length > 0) {
		return contentData.chapters;
	}
	if (contentData?.chapter) {
		return [contentData.chapter];
	}
	return [];
}

function computeChapterDisplayLabel(displayChapters: ChapterDetailItem[]): string | undefined {
	if (displayChapters.length <= 1) return undefined;
	const first = displayChapters[0].chapterNumber;
	const last = displayChapters[displayChapters.length - 1].chapterNumber;
	return `${first} - ${last}`;
}

function isTouchMoved(touch: React.Touch | undefined, startPos: { x: number; y: number } | null): boolean {
	if (!touch || !startPos) return false;
	const deltaX = Math.abs(touch.clientX - startPos.x);
	const deltaY = Math.abs(touch.clientY - startPos.y);
	return deltaX > 10 || deltaY > 10;
}

function hasTextSelection(): boolean {
	if (typeof window === 'undefined') return false;
	const selection = window.getSelection();
	return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function scrollElementIntoView(el: Element | null): boolean {
	if (!el || typeof el.scrollIntoView !== 'function') return false;
	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	return true;
}

function locateActiveReadingElement(activeParagraphIndex: number, isTTSPlayingOrPaused: boolean): void {
	if (typeof document === 'undefined') return;

	// 1. Locate Edge / Browser Read Aloud highlight element
	const highlightEl = document.querySelector(
		'.msreadout-line-highlight, .msreadout-word-highlight, .msreadout-highlight, msreadoutspan, [class*="msreadout"], [data-readout-highlight]'
	);
	if (scrollElementIntoView(highlightEl)) return;

	// 2. Locate App TTS active paragraph
	if (isTTSPlayingOrPaused && activeParagraphIndex >= 0) {
		const paragraphEl = document.querySelector(`[data-paragraph-index="${activeParagraphIndex}"]`);
		scrollElementIntoView(paragraphEl);
	}
}

interface ResolvedChapterTarget {
	chapterId: string;
	chapterNumber?: number;
	title?: string;
}

async function fetchServerLastRead(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const lastRead = await BookRepository.getLastReadChapter(bookId, { forceFresh: true });
		if (lastRead?.chapterId) return lastRead;
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy lastRead từ server, thử fallback sang latest:', err);
	}
	return null;
}

async function fetchServerLatest(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const latest = await ChapterRepository.getLatestChapter(bookId, { forceFresh: true });
		if (latest?.chapterId) return latest;
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy latest từ server, thử fallback sang offlineDb:', err);
	}
	return null;
}

async function fetchOfflineLastRead(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const offlineBook = await offlineDb.getBook(bookId);
		const lastRead = offlineBook?.lastReadChapter;
		if (!lastRead?.chapterId) return null;
		const chapterNumber =
			typeof lastRead.chapterNumber === 'number' ? lastRead.chapterNumber : parseInt(String(lastRead.chapterNumber), 10) || 1;
		return { chapterId: lastRead.chapterId, chapterNumber, title: lastRead.title };
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy book từ offlineDb:', err);
		return null;
	}
}

async function resolveLatestReadingChapter(bookId: string): Promise<ResolvedChapterTarget | null> {
	const lastRead = await fetchServerLastRead(bookId);
	if (lastRead) return lastRead;

	const latest = await fetchServerLatest(bookId);
	if (latest) return latest;

	return fetchOfflineLastRead(bookId);
}

function computeDragOffset(offset: number, hasPrev: boolean, hasNext: boolean): number {
	const isOverscrollingStart = !hasPrev && offset > 0;
	const isOverscrollingEnd = !hasNext && offset < 0;
	if (isOverscrollingStart || isOverscrollingEnd) {
		return offset * 0.25;
	}
	return offset;
}

function formatNavChapterHint(navItem?: { title?: string; chapterNumber?: number }): string | undefined {
	if (!navItem) return undefined;
	if (navItem.title) return navItem.title;
	if (navItem.chapterNumber) return `Chương ${navItem.chapterNumber}`;
	return undefined;
}

function resolvePendingTitleHint(
	swipeDirection: 'left' | 'right' | null,
	dragOffset: number,
	nav?: ChapterContent['navigation']
): string | undefined {
	if (swipeDirection === 'left' || dragOffset < 0) {
		return formatNavChapterHint(nav?.next);
	}
	if (swipeDirection === 'right' || dragOffset > 0) {
		return formatNavChapterHint(nav?.prev);
	}
	return undefined;
}

function applySettledDragTransform(contentEl: HTMLDivElement | null, settled?: 'left' | 'right' | 'cancel') {
	if (!contentEl) return;
	if (settled === 'left') {
		contentEl.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
		contentEl.style.transform = 'translate3d(-100%, 0, 0)';
		return;
	}
	if (settled === 'right') {
		contentEl.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
		contentEl.style.transform = 'translate3d(100%, 0, 0)';
		return;
	}
	contentEl.style.transition = 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1)';
	contentEl.style.transform = 'translate3d(0px, 0, 0)';
}

function getSwipeCommitThreshold(): number {
	const width = typeof window === 'undefined' ? 390 : Math.min(window.innerWidth || 390, 448);
	return Math.max(90, Math.round(width * 0.3));
}

function buildParagraphChapterContexts(displayChapters: ChapterDetailItem[], bookId?: string, bookName?: string) {
	return displayChapters.flatMap((chap) =>
		(chap.content || []).map(() => ({
			bookId: bookId || chap.bookId,
			bookName: bookName || chap.bookName,
			chapterId: chap.chapterId,
			chapterNumber: chap.chapterNumber,
			chapterTitle: chap.title,
		}))
	);
}

function useReaderConfig() {
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

function useEdgeReadAloudDetector(): boolean {
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

function useActiveChapterObserver({ bookId, displayChapters }: UseActiveChapterObserverProps) {
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

function useZenControls() {
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

interface UseScrollProgressProps {
	displayChapters: ChapterDetailItem[];
	activeChapter: { chapterId: string } | null;
	onNearBottom: () => void;
}

function useScrollProgress({ displayChapters, activeChapter, onNearBottom }: UseScrollProgressProps) {
	const [scrollProgress, setScrollProgress] = useState(0);
	const lastScrollY = useRef(0);
	const scrollAnimRef = useRef<number | null>(null);

	useEffect(() => {
		const handleScroll = () => {
			if (scrollAnimRef.current !== null) return;
			scrollAnimRef.current = requestAnimationFrame(() => {
				const currentY = window.scrollY;
				const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
				if (totalHeight > 0) {
					const newProgress = (currentY / totalHeight) * 100;
					setScrollProgress((prev) => (Math.abs(prev - newProgress) > 0.5 ? newProgress : prev));

					const lastChap = displayChapters[displayChapters.length - 1];
					const isLastChapterActive = !lastChap || !activeChapter || activeChapter.chapterId === lastChap.chapterId;
					const isNearBottom = isLastChapterActive && (currentY >= totalHeight - 40 || newProgress >= 98);
					if (isNearBottom) {
						onNearBottom();
					}
				}
				lastScrollY.current = currentY;
				scrollAnimRef.current = null;
			});
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current);
		};
	}, [displayChapters, activeChapter, onNearBottom]);

	return scrollProgress;
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

function isSwipeDisabled(isNative: boolean, loading: boolean, isRefreshing: boolean): boolean {
	if (!isNative) return true;
	if (loading) return true;
	return isRefreshing;
}

interface UseReaderSwipeProps {
	bookId?: string;
	chapterId?: string;
	contentData: ChapterContent | null;
	loading: boolean;
	isRefreshingLatest: boolean;
}

function useReaderSwipeNavigation({ bookId, chapterId, contentData, loading, isRefreshingLatest }: UseReaderSwipeProps) {
	const navigate = useNavigate();
	const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState(0);
	const readerContentRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setSwipeDirection(null);
		setIsDragging(false);
		setDragOffset(0);
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
			setDragOffset(effectiveOffset);
			contentEl.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
		},
		[contentData?.navigation]
	);

	const handleDragEnd = useCallback((settled?: 'left' | 'right' | 'cancel') => {
		setIsDragging(false);
		setDragOffset(0);
		applySettledDragTransform(readerContentRef.current, settled);
	}, []);

	const pendingTitleHint = useMemo(
		() => resolvePendingTitleHint(swipeDirection, dragOffset, contentData?.navigation),
		[swipeDirection, dragOffset, contentData?.navigation]
	);

	const commitThreshold = getSwipeCommitThreshold();
	const isNative = Capacitor.isNativePlatform();
	const swipeDisabled = isSwipeDisabled(isNative, loading, isRefreshingLatest);

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

interface ReaderModalsProps {
	bookId?: string;
	chapterId?: string;
	activeChapter: { chapterId: string; chapterNumber: number; title: string } | null;
	chapterTitle: string;
	chapterNumber: number;
	displayChapters: ChapterDetailItem[];
	showTypographySheet: boolean;
	showChapterSelectSheet: boolean;
	showHistorySheet: boolean;
	showTranslateSheet: boolean;
	onCloseTypography: () => void;
	onCloseChapterSelect: () => void;
	onCloseHistory: () => void;
	onCloseTranslate: () => void;
	onTranslateSuccess: () => void;
}

function ReaderModals({
	bookId,
	chapterId,
	activeChapter,
	chapterTitle,
	chapterNumber,
	displayChapters,
	showTypographySheet,
	showChapterSelectSheet,
	showHistorySheet,
	showTranslateSheet,
	onCloseTypography,
	onCloseChapterSelect,
	onCloseHistory,
	onCloseTranslate,
	onTranslateSuccess,
}: ReaderModalsProps) {
	const currentChapId = activeChapter?.chapterId || chapterId;
	const currentChapNum = activeChapter?.chapterNumber ?? chapterNumber;

	const selectedChapters = useMemo(() => {
		if (displayChapters.length > 0) return displayChapters.map((c) => c.chapterId);
		if (chapterId) return [chapterId];
		return [];
	}, [displayChapters, chapterId]);

	return (
		<div aria-hidden="true">
			<GlobalSettingsSheet currentBookId={bookId} currentChapterId={chapterId} />

			{showTypographySheet && <QuickTypographySheet onClose={onCloseTypography} />}

			{showChapterSelectSheet && (
				<QuickChapterSelectSheet
					bookId={bookId || ''}
					currentChapterId={currentChapId}
					currentChapterNumber={currentChapNum}
					onClose={onCloseChapterSelect}
				/>
			)}

			{showHistorySheet && <QuickBookHistorySheet currentBookId={bookId} onClose={onCloseHistory} />}

			{showTranslateSheet && (
				<TranslationSheet
					currentBookId={bookId}
					currentChapterId={chapterId}
					currentChapterName={chapterTitle}
					currentChapterNumber={chapterNumber}
					initialTab="batch_chapter"
					initialSelectedChapters={selectedChapters}
					onClose={onCloseTranslate}
					onSuccess={onTranslateSuccess}
				/>
			)}
		</div>
	);
}

function ReaderLoadingView({ fontClass, bookId, onOpenHistory }: { fontClass: string; bookId?: string; onOpenHistory: () => void }) {
	return (
		<div className={`min-h-dvh w-full bg-background text-on-background relative overflow-x-hidden ${fontClass}`}>
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl lg:max-w-5xl h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />
			<ReaderHeader bookId={bookId || ''} progress={0} isVisible={true} onOpenHistory={onOpenHistory} />
			<div className="w-full max-w-4xl lg:max-w-5xl mx-auto px-2 sm:px-6 md:px-8">
				<ReaderChapterSkeleton />
			</div>
		</div>
	);
}

function ReaderErrorView({
	error,
	onRefresh,
	onRetry,
	onHome,
	pullDisabled,
}: {
	error: string | null;
	onRefresh: () => void;
	onRetry: () => void;
	onHome: () => void;
	pullDisabled: boolean;
}) {
	return (
		<div className="min-h-dvh w-full bg-background flex flex-col items-center justify-center p-6 text-center">
			<div className="w-full max-w-md mx-auto flex flex-col items-center">
				<PullToRefresh onRefresh={onRefresh} disabled={pullDisabled} showIndicator={false} />
				<AlertCircle size={40} className="text-error mb-3" />
				<h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải chương</h2>
				<p className="text-xs text-on-surface-variant max-w-xs mb-5">{error || 'Chương không tồn tại'}</p>

				<div className="flex items-center justify-center gap-3">
					<button
						onClick={onRetry}
						className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
					>
						<RotateCcw size={14} />
						<span>Thử tải lại</span>
					</button>

					<button
						onClick={onHome}
						className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
					>
						<Home size={14} />
						<span>Về Trang chủ</span>
					</button>
				</div>
			</div>
		</div>
	);
}

function fetchChapterContent(chapterId: string, groupLines: number, isEnabledReplace: boolean, batchSize: number, isForceFresh: boolean) {
	if (isForceFresh) {
		return ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', batchSize, { forceFresh: true });
	}
	return ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', batchSize);
}

function useChapterLoader(chapterId: string | undefined, config: ReturnType<typeof useReaderConfig>) {
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

function resolveTargetBookId(bookId?: string, firstChap?: ChapterDetailItem): string | undefined {
	if (bookId) return bookId;
	return firstChap?.bookId;
}

function resolveTargetBookName(chapter?: ChapterDetailItem, firstChap?: ChapterDetailItem): string | undefined {
	if (chapter && chapter.bookName) return chapter.bookName;
	return firstChap?.bookName;
}

function resolveTargetChapterId(chapterId?: string, firstChap?: ChapterDetailItem): string | undefined {
	if (chapterId) return chapterId;
	return firstChap?.chapterId;
}

function resolveTargetTitle(chapter?: ChapterDetailItem, firstChap?: ChapterDetailItem): string | undefined {
	if (chapter && chapter.title) return chapter.title;
	return firstChap?.title;
}

function buildChapterTarget(firstChap: ChapterDetailItem | undefined, bookId?: string, chapterId?: string, chapter?: ChapterDetailItem) {
	return {
		bookId: resolveTargetBookId(bookId, firstChap),
		bookName: resolveTargetBookName(chapter, firstChap),
		chapterId: resolveTargetChapterId(chapterId, firstChap),
		chapterNumber: firstChap?.chapterNumber,
		chapterTitle: resolveTargetTitle(chapter, firstChap),
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

function useReaderAudioService({
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

function resolveViewingMetadata(
	chapter: ChapterDetailItem,
	activeChapter: { title: string; chapterNumber: number; chapterId: string } | null
) {
	const currentViewingTitle = activeChapter?.title || chapter.title;
	const currentViewingNumber = activeChapter?.chapterNumber ?? chapter.chapterNumber;
	return { currentViewingTitle, currentViewingNumber };
}

function checkNavDockVisible(showZenControls: boolean, showTTSControl: boolean, isTTSActive: boolean, hasEdgeReadAloud: boolean): boolean {
	if (!showZenControls) return false;
	return showTTSControl || isTTSActive || hasEdgeReadAloud;
}

interface ReaderQuickControlDockProps {
	bookId?: string;
	chapterId?: string;
	navigation?: ChapterContent['navigation'];
	currentViewingNumber: number;
	chapterDisplayLabel?: string;
	displayChapters: ChapterDetailItem[];
	activeChapterId?: string;
	isVisible: boolean;
	onOpenChapterSelect: () => void;
	onOpenTranslation: () => void;
}

function ReaderQuickControlDock({
	bookId,
	chapterId,
	navigation,
	currentViewingNumber,
	chapterDisplayLabel,
	displayChapters,
	activeChapterId,
	isVisible,
	onOpenChapterSelect,
	onOpenTranslation,
}: ReaderQuickControlDockProps) {
	const prevChapterId = navigation?.prev?.chapterId;
	const nextChapterId = navigation?.next?.chapterId;

	return (
		<div aria-hidden="true">
			<ReaderQuickControl
				bookId={bookId || ''}
				currentChapterId={chapterId}
				prevChapterId={prevChapterId}
				nextChapterId={nextChapterId}
				currentChapterNumber={currentViewingNumber}
				chapterDisplayLabel={chapterDisplayLabel}
				chapters={displayChapters}
				activeChapterId={activeChapterId}
				isVisible={isVisible}
				onOpenChapterSelect={onOpenChapterSelect}
				onOpenTranslation={onOpenTranslation}
			/>
		</div>
	);
}

interface ReaderScrollContentProps {
	swipe: ReturnType<typeof useReaderSwipeNavigation>;
	isChapterLoading: boolean;
	chapterId?: string;
	domResetKey: number;
	chapter: ChapterDetailItem;
	displayChapters: ChapterDetailItem[];
	fontSize: number;
	lineHeight: number;
	tts: ReturnType<typeof useReadAloud>;
	zen: ReturnType<typeof useZenControls>;
}

function ReaderScrollContent({
	swipe,
	isChapterLoading,
	chapterId,
	domResetKey,
	chapter,
	displayChapters,
	fontSize,
	lineHeight,
	tts,
	zen,
}: ReaderScrollContentProps) {
	return (
		<div className="relative w-full max-w-4xl lg:max-w-5xl mx-auto overflow-hidden px-2 sm:px-6 md:px-8">
			{swipe.isDragging && (
				<div
					aria-hidden="true"
					className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-90 transition-opacity duration-150"
				>
					<ReaderChapterSkeleton titleHint={swipe.pendingTitleHint} />
				</div>
			)}

			<div ref={swipe.readerContentRef} className="w-full will-change-transform relative z-10 bg-background">
				{isChapterLoading ? (
					<div key={`loading-skeleton-${chapterId}`} className="w-full bg-background">
						<ReaderChapterSkeleton titleHint={swipe.pendingTitleHint} />
					</div>
				) : (
					<div key={`${chapter.chapterId}-${domResetKey}`} className="w-full">
						<ChapterContentSection
							chapters={displayChapters}
							fontSize={fontSize}
							lineHeight={lineHeight}
							isPlaying={tts.isPlaying}
							isPaused={tts.isPaused}
							currentParagraphIndex={tts.activeParagraphIndex}
							onDoubleClick={zen.handleDoubleClick}
							onTouchStart={zen.handleTouchStart}
							onTouchEnd={zen.handleTouchEnd}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

interface ReaderActiveViewProps {
	fontClass: string;
	pullDisabled: boolean;
	bookId?: string;
	chapterId?: string;
	contentData: ChapterContent;
	displayChapters: ChapterDetailItem[];
	activeChapter: { chapterId: string; chapterNumber: number; title: string } | null;
	scrollProgress: number;
	isRefreshingLatest: boolean;
	hasEdgeReadAloud: boolean;
	config: ReturnType<typeof useReaderConfig>;
	tts: ReturnType<typeof useReadAloud>;
	bgm: ReturnType<typeof useEdgeReadAloudBgm>;
	zen: ReturnType<typeof useZenControls>;
	swipe: ReturnType<typeof useReaderSwipeNavigation>;
	domResetKey: number;
	showTranslateSheet: boolean;
	showTypographySheet: boolean;
	showChapterSelectSheet: boolean;
	showHistorySheet: boolean;
	onPullRefresh: () => Promise<void>;
	onStopTTS: () => void;
	onToggleBgm: () => void;
	onOpenHistory: () => void;
	onOpenChapterSelect: () => void;
	onOpenTranslation: () => void;
	onTitleClick: () => void;
	onTitleDoubleClick: () => Promise<void>;
	onCloseTranslate: () => void;
	onCloseTypography: () => void;
	onCloseChapterSelect: () => void;
	onCloseHistory: () => void;
	onTranslateSuccess: () => void;
}

function ReaderActiveView({
	fontClass,
	pullDisabled,
	bookId,
	chapterId,
	contentData,
	displayChapters,
	activeChapter,
	scrollProgress,
	isRefreshingLatest,
	hasEdgeReadAloud,
	config,
	tts,
	bgm,
	zen,
	swipe,
	domResetKey,
	showTranslateSheet,
	showTypographySheet,
	showChapterSelectSheet,
	showHistorySheet,
	onPullRefresh,
	onStopTTS,
	onToggleBgm,
	onOpenHistory,
	onOpenChapterSelect,
	onOpenTranslation,
	onTitleClick,
	onTitleDoubleClick,
	onCloseTranslate,
	onCloseTypography,
	onCloseChapterSelect,
	onCloseHistory,
	onTranslateSuccess,
}: ReaderActiveViewProps) {
	const { chapter, navigation } = contentData;
	const { currentViewingTitle, currentViewingNumber } = resolveViewingMetadata(chapter, activeChapter);
	const chapterDisplayLabel = computeChapterDisplayLabel(displayChapters);
	const isChapterChanging = Boolean(chapterId && contentData.chapter.chapterId !== chapterId);
	const isNavDockVisible = checkNavDockVisible(zen.showZenControls, config.showTTSControlOnReader, tts.isTTSActive, hasEdgeReadAloud);

	return (
		<div
			className={`min-h-dvh w-full bg-background text-on-background relative overflow-x-hidden hide-scrollbar no-scrollbar transition-colors duration-200 selection:bg-primary/25 selection:text-primary ${fontClass}`}
		>
			<PullToRefresh onRefresh={onPullRefresh} disabled={pullDisabled} showIndicator={false} />

			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl lg:max-w-5xl h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />

			<ReaderHeader
				bookId={bookId || ''}
				bookName={chapter.bookName}
				chapterNumber={currentViewingNumber}
				chapterTitle={currentViewingTitle}
				progress={scrollProgress}
				isVisible={true}
				isTTSActive={tts.isTTSActive}
				isRefreshingLatest={isRefreshingLatest}
				onToggleTTS={() => (tts.isTTSActive ? onStopTTS() : tts.startReading())}
				onOpenHistory={onOpenHistory}
				onTitleClick={onTitleClick}
				onTitleDoubleClick={onTitleDoubleClick}
			/>

			<VerticalBatchChapterNav
				chapters={displayChapters}
				activeChapterId={activeChapter?.chapterId}
				isVisible={isNavDockVisible}
				isTTSActive={tts.isTTSActive}
				isTTSLoading={tts.isLoading}
				isTTSPlaying={tts.isPlaying}
				isBgmActive={bgm.isPlaying}
				showTTSControl={config.showTTSControlOnReader}
				onToggleBgm={onToggleBgm}
				currentParagraphIndex={tts.activeParagraphIndex}
				onToggleTTS={() => (tts.isTTSActive ? onStopTTS() : tts.startReading())}
				onTTSPlay={tts.startReading}
				onTTSPause={tts.pauseReading}
				onTTSStop={onStopTTS}
				onTTSPrev={tts.prevSection}
				onTTSNext={tts.nextSection}
				onLocateReadingLine={tts.locateReadingLine}
			/>

			<ReaderScrollContent
				swipe={swipe}
				isChapterLoading={isChapterChanging}
				chapterId={chapterId}
				domResetKey={domResetKey}
				chapter={chapter}
				displayChapters={displayChapters}
				fontSize={config.fontSize}
				lineHeight={config.lineHeight}
				tts={tts}
				zen={zen}
			/>

			<ReaderQuickControlDock
				bookId={bookId}
				chapterId={chapterId}
				navigation={navigation}
				currentViewingNumber={currentViewingNumber}
				chapterDisplayLabel={chapterDisplayLabel}
				displayChapters={displayChapters}
				activeChapterId={activeChapter?.chapterId}
				isVisible={zen.showZenControls}
				onOpenChapterSelect={onOpenChapterSelect}
				onOpenTranslation={onOpenTranslation}
			/>

			<ReaderModals
				bookId={bookId}
				chapterId={chapterId}
				activeChapter={activeChapter}
				chapterTitle={chapter.title}
				chapterNumber={chapter.chapterNumber}
				displayChapters={displayChapters}
				showTypographySheet={showTypographySheet}
				showChapterSelectSheet={showChapterSelectSheet}
				showHistorySheet={showHistorySheet}
				showTranslateSheet={showTranslateSheet}
				onCloseTypography={onCloseTypography}
				onCloseChapterSelect={onCloseChapterSelect}
				onCloseHistory={onCloseHistory}
				onCloseTranslate={onCloseTranslate}
				onTranslateSuccess={onTranslateSuccess}
			/>

			<SelectionSpeakerTooltip isTTSActive={tts.isTTSActive} onSpeak={tts.jumpToContent} />

			{zen.ripple && (
				<span
					key={zen.ripple.id}
					onAnimationEnd={() => zen.setRipple(null)}
					className="pointer-events-none fixed z-[99999] w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60 bg-primary/20 animate-ripple"
					style={{ left: zen.ripple.x, top: zen.ripple.y }}
				/>
			)}
		</div>
	);
}

function useReaderSheets() {
	const [showTranslateSheet, setShowTranslateSheet] = useState(false);
	const [showTypographySheet, setShowTypographySheet] = useState(false);
	const [showChapterSelectSheet, setShowChapterSelectSheet] = useState(false);
	const [showHistorySheet, setShowHistorySheet] = useState(false);

	const handleOpenHistory = useCallback(() => setShowHistorySheet(true), []);
	const handleOpenChapterSelect = useCallback(() => setShowChapterSelectSheet(true), []);
	const handleOpenTranslation = useCallback(() => setShowTranslateSheet(true), []);
	const handleCloseHistory = useCallback(() => setShowHistorySheet(false), []);
	const handleCloseChapterSelect = useCallback(() => setShowChapterSelectSheet(false), []);
	const handleCloseTranslation = useCallback(() => setShowTranslateSheet(false), []);
	const handleCloseTypography = useCallback(() => setShowTypographySheet(false), []);

	return {
		showTranslateSheet,
		showTypographySheet,
		showChapterSelectSheet,
		showHistorySheet,
		handleOpenHistory,
		handleOpenChapterSelect,
		handleOpenTranslation,
		handleCloseHistory,
		handleCloseChapterSelect,
		handleCloseTranslation,
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

function useTitleBarActions({
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

function computeAllParagraphs(displayChapters: ChapterDetailItem[]): string[] {
	return displayChapters.flatMap((chap) => chap.content || []);
}

function resolveReaderBookName(contentData: ChapterContent | null): string | undefined {
	return contentData?.chapter?.bookName;
}

function isReaderPullDisabled(loading: boolean, isRefreshing: boolean, isTTSActive: boolean): boolean {
	if (loading) return true;
	if (isRefreshing) return true;
	return Boolean(hasNativeReaderGestures() && isTTSActive);
}

function shouldShowReaderLoading(loading: boolean, hasContent: boolean): boolean {
	return loading && !hasContent;
}

function shouldShowReaderError(error: string | null, hasContent: boolean): boolean {
	return Boolean(error || !hasContent);
}

export function ReaderScreen() {
	const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
	const navigate = useNavigate();

	const config = useReaderConfig();
	const fontClass = getFontClass(config.font);

	const { contentData, loading, domResetKey, error, forceFreshNextLoadRef, loadChapter } = useChapterLoader(chapterId, config);

	const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
	useGlobalLoading(isRefreshingLatest);
	const bookName = resolveReaderBookName(contentData);
	useDocumentTitle(bookName);

	const displayChapters = useMemo(() => computeDisplayChapters(contentData), [contentData]);

	const allParagraphs = useMemo(() => computeAllParagraphs(displayChapters), [displayChapters]);

	const paragraphChapterContexts = useMemo(
		() => buildParagraphChapterContexts(displayChapters, bookId, bookName),
		[displayChapters, bookId, bookName]
	);

	const { tts, bgm, handleStopTTS, handleToggleBgm } = useReaderAudioService({
		bookId,
		chapterId,
		contentData,
		displayChapters,
		allParagraphs,
		paragraphChapterContexts,
		config,
	});

	const hasContent = contentData !== null;
	const isContentReady = !loading && hasContent;
	useReadingProgress(bookId, chapterId, isContentReady);

	const activeChapter = useActiveChapterObserver({ bookId, displayChapters });
	const zen = useZenControls();

	const handleNearBottom = useCallback(() => {
		zen.setShowZenControls(true);
	}, [zen]);

	const scrollProgress = useScrollProgress({
		displayChapters,
		activeChapter,
		onNearBottom: handleNearBottom,
	});

	const sheets = useReaderSheets();
	const hasEdgeReadAloud = useEdgeReadAloudDetector();

	const { handleTitleSingleClick, handleTitleDoubleClick } = useTitleBarActions({
		bookId,
		chapterId,
		activeChapterId: activeChapter?.chapterId,
		isRefreshingLatest,
		setIsRefreshingLatest,
		tts,
		handleStopTTS,
		loadChapter,
		forceFreshNextLoadRef,
	});

	const handlePullRefresh = useCallback(async () => {
		tts.clearResumePosition();
		handleStopTTS();
		await clearAllCaches();
		await loadChapter(true);
	}, [tts, handleStopTTS, loadChapter]);

	const swipe = useReaderSwipeNavigation({
		bookId,
		chapterId,
		contentData,
		loading,
		isRefreshingLatest,
	});

	const pullDisabled = isReaderPullDisabled(loading, isRefreshingLatest, tts.isTTSActive);

	if (shouldShowReaderLoading(loading, hasContent)) {
		return <ReaderLoadingView fontClass={fontClass} bookId={bookId} onOpenHistory={sheets.handleOpenHistory} />;
	}

	if (shouldShowReaderError(error, hasContent)) {
		return (
			<ReaderErrorView
				error={error}
				onRefresh={handlePullRefresh}
				onRetry={loadChapter}
				onHome={() => navigate('/')}
				pullDisabled={pullDisabled}
			/>
		);
	}

	return (
		<ReaderActiveView
			fontClass={fontClass}
			pullDisabled={pullDisabled}
			bookId={bookId}
			chapterId={chapterId}
			contentData={contentData}
			displayChapters={displayChapters}
			activeChapter={activeChapter}
			scrollProgress={scrollProgress}
			isRefreshingLatest={isRefreshingLatest}
			hasEdgeReadAloud={hasEdgeReadAloud}
			config={config}
			tts={tts}
			bgm={bgm}
			zen={zen}
			swipe={swipe}
			domResetKey={domResetKey}
			showTranslateSheet={sheets.showTranslateSheet}
			showTypographySheet={sheets.showTypographySheet}
			showChapterSelectSheet={sheets.showChapterSelectSheet}
			showHistorySheet={sheets.showHistorySheet}
			onPullRefresh={handlePullRefresh}
			onStopTTS={handleStopTTS}
			onToggleBgm={handleToggleBgm}
			onOpenHistory={sheets.handleOpenHistory}
			onOpenChapterSelect={sheets.handleOpenChapterSelect}
			onOpenTranslation={sheets.handleOpenTranslation}
			onTitleClick={handleTitleSingleClick}
			onTitleDoubleClick={handleTitleDoubleClick}
			onCloseTranslate={sheets.handleCloseTranslation}
			onCloseTypography={sheets.handleCloseTypography}
			onCloseChapterSelect={sheets.handleCloseChapterSelect}
			onCloseHistory={sheets.handleCloseHistory}
			onTranslateSuccess={loadChapter}
		/>
	);
}
