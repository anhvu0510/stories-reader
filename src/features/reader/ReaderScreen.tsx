import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';

import { motion } from 'motion/react';

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
import { clearAllCaches } from '@/shared/utils/cacheUtils';
import { openNextChapter, openPrevChapter } from '@/shared/utils/openChapter';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { ParagraphView } from './components/ParagraphView';
import { QuickBookHistorySheet } from './components/QuickBookHistorySheet';
import { QuickChapterSelectSheet } from './components/QuickChapterSelectSheet';
import { QuickTypographySheet } from './components/QuickTypographySheet';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderQuickControl } from './components/ReaderQuickControl';
import { ReaderChapterSkeleton } from './components/ReaderChapterSkeleton';
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
	onTouchEnd
}: ChapterContentSectionProps) {
	const paragraphOffsets = chapters.map((_, chapterIndex) => chapters.slice(0, chapterIndex).reduce((total, chapter) => total + chapter.content.length, 0));

	return (
		<main
			id="main-story-content"
			onDoubleClick={onDoubleClick}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			className="pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] sm:pt-24 pb-24 select-text relative z-10"
		>
			{chapters.map((chap, chapIdx) => (
				<section
					key={chap.chapterId || chapIdx}
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
							<p>{chap.title?.toLowerCase().startsWith('chương') ? chap.title : `Chương ${chap.chapterNumber}: ${chap.title}`}</p>
						</h2>
					</div>

					{/* Chapter Paragraphs */}
					<article className="px-4 select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
						{chap.content.map((paragraphHtml, index) => {
							const paragraphIndex = paragraphOffsets[chapIdx] + index;
							return (
								<ParagraphView
									key={`${chap.chapterId}-${index}`}
									index={paragraphIndex}
									content={paragraphHtml}
									isTTSActive={(isPlaying || isPaused) && currentParagraphIndex === paragraphIndex}
									onDoubleClick={onDoubleClick}
									onTouchEnd={onTouchEnd}
								/>
							);
						})}
					</article>
				</section>
			))}
		</main>
	);
});

export function ReaderScreen() {
	const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
	const navigate = useNavigate();

	const showToast = useToastStore((state) => state.showToast);

	// Store Selectors to prevent unnecessary re-renders
	const font = useReaderConfigStore((state) => state.font);
	const fontSize = useReaderConfigStore((state) => state.fontSize);
	const lineHeight = useReaderConfigStore((state) => state.lineHeight);
	const groupLines = useReaderConfigStore((state) => state.groupLines);
	const batchChapterSize = useReaderConfigStore((state) => state.batchChapterSize || 1);
	const isEnabledReplace = useReaderConfigStore((state) => state.isEnabledReplace);
	const showTTSControlOnReader = useReaderConfigStore((state) => state.showTTSControlOnReader ?? true);

	const [contentData, setContentData] = useState<ChapterContent | null>(null);
	const [loading, setLoading] = useState(true);
	const [domResetKey, setDomResetKey] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
	const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
	const forceFreshNextLoadRef = useRef(false);

	// Normalized list of chapters to display
	const displayChapters: ChapterDetailItem[] = useMemo(() => {
		if (contentData?.chapters && contentData.chapters.length > 0) {
			return contentData.chapters;
		}
		if (contentData?.chapter) {
			return [contentData.chapter];
		}
		return [];
	}, [contentData]);

	const allParagraphs = useMemo(() => {
		return displayChapters.flatMap((chap) => chap.content || []);
	}, [displayChapters]);

	const paragraphChapterContexts = useMemo(() => {
		return displayChapters.flatMap((chap) =>
			(chap.content || []).map(() => ({
				bookId: bookId || chap.bookId,
				bookName: contentData?.chapter?.bookName || chap.bookName,
				chapterId: chap.chapterId,
				chapterNumber: chap.chapterNumber,
				chapterTitle: chap.title
			}))
		);
	}, [bookId, displayChapters, contentData?.chapter?.bookName]);

	const {
		isPlaying,
		isPaused,
		isLoading: isTTSLoading,
		isTTSActive,
		activeParagraphIndex,
		startReading,
		pauseReading,
		stopReading,
		nextSection,
		prevSection,
		jumpToContent,
		clearResumePosition
	} = useReadAloud(
		allParagraphs,
		{
			bookId: bookId || displayChapters[0]?.bookId,
			bookName: contentData?.chapter?.bookName || displayChapters[0]?.bookName,
			chapterId: chapterId || displayChapters[0]?.chapterId,
			chapterNumber: displayChapters[0]?.chapterNumber,
			chapterTitle: contentData?.chapter?.title || displayChapters[0]?.title
		},
		paragraphChapterContexts
	);

	const handleSelectionSpeak = useCallback(
		(paragraphIndex: number, charOffset: number) => {
			jumpToContent(paragraphIndex, charOffset);
		},
		[jumpToContent]
	);

	// Keep single global LoadingOverlay active until chapter data is rendered in React state
	useGlobalLoading(loading || isRefreshingLatest);

	// Sync document.title with the current reading story name
	useDocumentTitle(contentData?.chapter?.bookName);

	const bgmEnabled = useReaderConfigStore((state) => state.bgmEnabled ?? true);
	const bgmVolume = useReaderConfigStore((state) => state.bgmVolume ?? 0.2);
	const bgmAudioUrl = useReaderConfigStore((state) => state.bgmAudioUrl || '/audio/ambient-bgm.mp3');
	const bgmFadeInMs = useReaderConfigStore((state) => state.bgmFadeInMs ?? 500);
	const bgmFadeOutMs = useReaderConfigStore((state) => state.bgmFadeOutMs ?? 800);
	const bgmStopDelayMs = useReaderConfigStore((state) => state.bgmStopDelayMs ?? 1500);
	const isBgmPreviewing = useReaderConfigStore((state) => state.isBgmPreviewing ?? false);

	// Background music automatically plays when Edge Read Aloud is active, app TTS is playing, or toggled manually
	const { isPlaying: isBgmPlaying, toggleBgm, stopBgm } = useEdgeReadAloudBgm({
		audioUrl: bgmAudioUrl,
		volume: bgmVolume,
		fadeInMs: bgmFadeInMs,
		fadeOutMs: bgmFadeOutMs,
		stopDelayMs: bgmStopDelayMs,
		enabled: bgmEnabled,
		isBgmPreviewing,
		isTTSActive: isTTSActive && isPlaying
	});

	const handleStopTTS = useCallback(() => {
		stopReading();
		stopBgm(true);
	}, [stopReading, stopBgm]);

	const handleToggleBgm = useCallback(() => {
		toggleBgm();
		const willPlay = !isBgmPlaying;
		showToast(willPlay ? 'Đã bật nhạc nền thư giãn' : 'Đã tắt nhạc nền', 'info');
	}, [toggleBgm, isBgmPlaying, showToast]);

	// Clean Reading Progress & Scroll Restoration
	const isContentReady = !loading && contentData !== null;
	useReadingProgress(bookId, chapterId, isContentReady);

	const [showTranslateSheet, setShowTranslateSheet] = useState(false);
	const [showTypographySheet, setShowTypographySheet] = useState(false);
	const [showChapterSelectSheet, setShowChapterSelectSheet] = useState(false);
	const [showHistorySheet, setShowHistorySheet] = useState(false);
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
			attributes: true
		});

		return () => observer.disconnect();
	}, []);

	// Zen Reader Mode: Dock controls show/hide state (Header stays ALWAYS VISIBLE)
	const [showZenControls, setShowZenControls] = useState(true);
	const [scrollProgress, setScrollProgress] = useState(0);
	const lastScrollY = useRef(0);
	const scrollAnimRef = useRef<number | null>(null);

	// Active Chapter currently in viewport
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
				title: displayChapters[0].title
			});
		} else {
			setActiveChapter(null);
		}
	}, [displayChapters]);

	// Scroll Tracking & IntersectionObserver for multi-chapter in viewport
	useEffect(() => {
		if (displayChapters.length <= 1) return;
		if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

		const handleIntersection: IntersectionObserverCallback = (entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const chapId = entry.target.getAttribute('data-chapter-id');
					const chapNum = Number(entry.target.getAttribute('data-chapter-number'));
					const chapTitle = entry.target.getAttribute('data-chapter-title') || '';
					if (chapId) {
						setActiveChapter({
							chapterId: chapId,
							chapterNumber: chapNum,
							title: chapTitle
						});
					}
				}
			}
		};

		const observer = new IntersectionObserver(handleIntersection, {
			rootMargin: '-10% 0px -70% 0px',
			threshold: [0, 0.2, 0.5]
		});

		const chapterBlocks = document.querySelectorAll('.chapter-block-section');
		chapterBlocks.forEach((el) => observer.observe(el));

		return () => {
			chapterBlocks.forEach((el) => observer.unobserve(el));
			observer.disconnect();
		};
	}, [displayChapters]);

	// Sync active reading chapter to local book history & server API with debounce
	const syncLastReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!activeChapter || !bookId) return;

		// Immediately update local offlineDb for zero data loss on instant refresh/close
		offlineDb.getBook(bookId).then((b) => {
			if (b) {
				b.lastReadChapter = {
					chapterId: activeChapter.chapterId,
					chapterNumber: activeChapter.chapterNumber,
					title: activeChapter.title
				};
				b.lastedReadAt = new Date().toISOString();
				offlineDb.saveBook(b);
			}
		});

		// Debounce server API sync (800ms) to avoid spamming network while scrolling fast
		if (syncLastReadTimerRef.current) {
			clearTimeout(syncLastReadTimerRef.current);
		}

		syncLastReadTimerRef.current = setTimeout(() => {
			BookRepository.updateLastReadChapter(bookId, {
				chapterId: activeChapter.chapterId,
				chapterNumber: activeChapter.chapterNumber,
				title: activeChapter.title
			});
		}, 800);

		return () => {
			if (syncLastReadTimerRef.current) {
				clearTimeout(syncLastReadTimerRef.current);
			}
		};
	}, [activeChapter, bookId]);

	// Throttled & Smooth scroll progress listener for Progress bar & End of Batch auto-show dock
	useEffect(() => {
		const handleScroll = () => {
			if (scrollAnimRef.current !== null) return;
			scrollAnimRef.current = requestAnimationFrame(() => {
				const currentY = window.scrollY;
				const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
				if (totalHeight > 0) {
					const newProgress = (currentY / totalHeight) * 100;
					setScrollProgress((prev) => (Math.abs(prev - newProgress) > 0.5 ? newProgress : prev));

					// Auto show dock ONLY when user reaches the very end of the ENTIRE group of chapters
					const lastChap = displayChapters[displayChapters.length - 1];
					const isLastChapterActive = !lastChap || !activeChapter || activeChapter.chapterId === lastChap.chapterId;
					const isNearBottom = isLastChapterActive && (currentY >= totalHeight - 40 || newProgress >= 98);
					if (isNearBottom) {
						setShowZenControls(true);
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
	}, [displayChapters, activeChapter]);

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

	// Record touch start coordinates to measure movement distance on touchEnd
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches && e.touches.length > 0) {
			touchStartPosRef.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY
			};
		}
	}, []);

	// Single unified toggle with 400ms lock to eliminate duplicate touch + dblclick flickering
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

	// Case 2: Double click / Double tap on reading screen to toggle bottom dock
	const handleDoubleClick = useCallback(
		(e?: React.MouseEvent) => {
			const selection = typeof window !== 'undefined' ? window.getSelection() : null;
			if (selection && !selection.isCollapsed && selection.toString().trim()) {
				return;
			}
			if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
			const coords = e ? { x: e.clientX, y: e.clientY } : undefined;
			toggleZenControls(coords);
		},
		[toggleZenControls]
	);

	const handleTouchEnd = useCallback(
		(e?: React.TouchEvent) => {
			const selection = typeof window !== 'undefined' ? window.getSelection() : null;
			if (selection && !selection.isCollapsed && selection.toString().trim()) {
				touchStartPosRef.current = null;
				return;
			}

			const now = Date.now();
			let isMoved = false;

			if (e && e.changedTouches && e.changedTouches.length > 0 && touchStartPosRef.current) {
				const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartPosRef.current.x);
				const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartPosRef.current.y);
				// If user moved more than 10px, treat as scroll gesture and DO NOT toggle zen controls
				if (deltaX > 10 || deltaY > 10) {
					isMoved = true;
				}
			}

			const savedPos = touchStartPosRef.current;
			touchStartPosRef.current = null;

			if (isMoved) {
				lastTapTimeRef.current = 0;
				return;
			}

			if (now - lastTapTimeRef.current < 350 && now - lastTapTimeRef.current > 40) {
				if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
				const coords = savedPos ? { x: savedPos.x, y: savedPos.y } : undefined;
				toggleZenControls(coords);
				lastTapTimeRef.current = 0;
			} else {
				lastTapTimeRef.current = now;
			}
		},
		[toggleZenControls]
	);

	// Fetch chapter data with instant loading feedback
	const loadChapter = useCallback(
		async (isForceFresh = false) => {
			if (!chapterId) return;
			setLoading(true);
			setError(null);
			try {
				const effectiveBatchSize = batchChapterSize;
				const res = isForceFresh
					? await ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', effectiveBatchSize, { forceFresh: true })
					: await ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace, '', effectiveBatchSize);
				
				// Cập nhật dữ liệu ngay khi API trả về, không trì hoãn nhân tạo
				setDomResetKey((k) => k + 1);
				setContentData(res);
				if (typeof window !== 'undefined' && window.scrollTo) {
					window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
				}
			} catch (e: any) {
				setError(e.message || 'Lỗi khi tải nội dung chương');
			} finally {
				setLoading(false);
			}
		},
		[chapterId, groupLines, isEnabledReplace, batchChapterSize]
	);

	useEffect(() => {
		const shouldForceFresh = forceFreshNextLoadRef.current;
		forceFreshNextLoadRef.current = false;
		loadChapter(shouldForceFresh);
	}, [chapterId, loadChapter]);

	const handleTitleSingleClick = useCallback(() => {
		if (typeof document === 'undefined') return;

		// 1. Locate Edge / Browser Read Aloud highlight element
		const highlightEl = document.querySelector('.msreadout-line-highlight, .msreadout-word-highlight, .msreadout-highlight, msreadoutspan, [class*="msreadout"], [data-readout-highlight]');
		if (highlightEl && typeof highlightEl.scrollIntoView === 'function') {
			highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		// 2. Locate App TTS active paragraph
		if ((isPlaying || isPaused) && activeParagraphIndex >= 0) {
			const paragraphEl = document.querySelector(`[data-paragraph-index="${activeParagraphIndex}"]`);
			if (paragraphEl && typeof paragraphEl.scrollIntoView === 'function') {
				paragraphEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}, [isPlaying, isPaused, activeParagraphIndex]);

	const handleTitleDoubleClick = useCallback(async () => {
		if (!bookId || isRefreshingLatest) return;
		setIsRefreshingLatest(true);
		handleStopTTS();
		try {
			// 1. Prioritize user's lastReadChapter from server API (same as history tab)
			const lastRead = await Promise.resolve(BookRepository.getLastReadChapter(bookId, { forceFresh: true })).catch((err) => {
				console.warn('[ReaderScreen] Không thể lấy lastRead từ server, thử fallback sang latest:', err);
				return null;
			});

			const latest = !lastRead
				? await Promise.resolve(ChapterRepository.getLatestChapter(bookId, { forceFresh: true })).catch((err) => {
						console.warn('[ReaderScreen] Không thể lấy latest từ server, thử fallback sang offlineDb:', err);
						return null;
					})
				: null;

			const offlineBook =
				!lastRead && !latest
					? await Promise.resolve(offlineDb.getBook(bookId)).catch((err) => {
							console.warn('[ReaderScreen] Không thể lấy book từ offlineDb:', err);
							return null;
						})
					: null;

			const targetChapter =
				lastRead ||
				latest ||
				(offlineBook?.lastReadChapter
					? {
							chapterId: offlineBook.lastReadChapter.chapterId,
							chapterNumber:
								typeof offlineBook.lastReadChapter.chapterNumber === 'number'
									? offlineBook.lastReadChapter.chapterNumber
									: parseInt(String(offlineBook.lastReadChapter.chapterNumber), 10) || 1,
							title: offlineBook.lastReadChapter.title
						}
					: null);

			const targetChapId = targetChapter?.chapterId || activeChapter?.chapterId || chapterId;
			if (!targetChapId) return;

			if (targetChapId === chapterId) {
				await loadChapter(true);
			} else {
				forceFreshNextLoadRef.current = true;
				navigate(`/book/${bookId}/chapter/${targetChapId}`);
			}
		} catch (err: any) {
			console.error('Lỗi khi tải lại chương:', err);
		} finally {
			setIsRefreshingLatest(false);
		}
	}, [bookId, chapterId, activeChapter, isRefreshingLatest, handleStopTTS, loadChapter, navigate]);

	const handleOpenHistory = useCallback(() => setShowHistorySheet(true), []);
	const handleOpenChapterSelect = useCallback(() => setShowChapterSelectSheet(true), []);
	const handleOpenTranslation = useCallback(() => setShowTranslateSheet(true), []);

	const handlePullRefresh = useCallback(async () => {
		clearResumePosition();
		handleStopTTS();
		await clearAllCaches();
		await loadChapter(true);
	}, [clearResumePosition, handleStopTTS, loadChapter]);

	// Native Swipe Gestures for Mobile Chapter Navigation with Smooth Page Transitions
	const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState(0);
	const readerContentRef = useRef<HTMLDivElement | null>(null);

	// Tự động thu hồi transform, giải phóng hướng vuốt và đưa vị trí đọc về đỉnh trang (top: 0) ngay khi sang chương mới
	useEffect(() => {
		setSwipeDirection(null);
		setIsDragging(false);
		setDragOffset(0);
		if (readerContentRef.current) {
			readerContentRef.current.style.transition = 'none';
			readerContentRef.current.style.transform = 'translate3d(0px, 0, 0)';
		}
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
	}, [chapterId]);

	const handleSwipeNext = useCallback(() => {
		if (!bookId || !contentData?.navigation?.next?.chapterId) return;
		setSwipeDirection('left');
		triggerHaptic('medium');
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
		openNextChapter(bookId, chapterId, contentData.navigation.next.chapterId);
	}, [bookId, chapterId, contentData?.navigation?.next?.chapterId]);

	const handleSwipePrev = useCallback(() => {
		if (!bookId || !contentData?.navigation?.prev?.chapterId) {
			triggerHaptic('light');
			navigate('/');
			return;
		}

		setSwipeDirection('right');
		triggerHaptic('medium');
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}

		openPrevChapter(bookId, chapterId, contentData.navigation.prev.chapterId);
	}, [bookId, chapterId, contentData?.navigation?.prev?.chapterId, navigate]);

	const handleDragStart = useCallback(() => {
		if (readerContentRef.current) {
			readerContentRef.current.style.transition = 'none';
		}
		setIsDragging(true);
	}, []);

	const handleDragMove = useCallback(
		(offset: number) => {
			if (!readerContentRef.current) return;
			const hasPrev = Boolean(contentData?.navigation?.prev?.chapterId);
			const hasNext = Boolean(contentData?.navigation?.next?.chapterId);
			let effectiveOffset = offset;
			if ((!hasPrev && offset > 0) || (!hasNext && offset < 0)) {
				effectiveOffset = offset * 0.25; // rubber band damping at boundaries
			}
			setDragOffset(effectiveOffset);
			readerContentRef.current.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
		},
		[contentData?.navigation?.prev?.chapterId, contentData?.navigation?.next?.chapterId]
	);

	const handleDragEnd = useCallback((settled?: 'left' | 'right' | 'cancel') => {
		setIsDragging(false);
		setDragOffset(0);
		if (!readerContentRef.current) return;
		if (settled === 'left') {
			readerContentRef.current.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
			readerContentRef.current.style.transform = 'translate3d(-100%, 0, 0)';
		} else if (settled === 'right') {
			readerContentRef.current.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
			readerContentRef.current.style.transform = 'translate3d(100%, 0, 0)';
		} else {
			// Thả tay khi chưa đủ ngưỡng cam kết: Snap Back mượt mà về vị trí ban đầu (0px)
			readerContentRef.current.style.transition = 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1)';
			readerContentRef.current.style.transform = 'translate3d(0px, 0, 0)';
		}
	}, []);

	// Xác định gợi ý tiêu đề chương kế tiếp/trước đó khi vuốt hoặc đang tải chương mới
	const pendingTitleHint = useMemo(() => {
		if (swipeDirection === 'left' || dragOffset < 0) {
			const next = contentData?.navigation?.next;
			return next?.title || (next?.chapterNumber ? `Chương ${next.chapterNumber}` : undefined);
		}
		if (swipeDirection === 'right' || dragOffset > 0) {
			const prev = contentData?.navigation?.prev;
			return prev?.title || (prev?.chapterNumber ? `Chương ${prev.chapterNumber}` : undefined);
		}
		return undefined;
	}, [swipeDirection, dragOffset, contentData?.navigation]);

	const isChapterChanging = Boolean(contentData && chapterId && contentData.chapter.chapterId !== chapterId);
	const isChapterLoading = loading || isChapterChanging;

	const contentWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth || 390, 448) : 390;
	const commitThreshold = Math.max(90, Math.round(contentWidth * 0.3));
	useSwipeGesture({
		onSwipeLeft: handleSwipeNext,
		onSwipeRight: handleSwipePrev,
		onDragStart: handleDragStart,
		onDragMove: handleDragMove,
		onDragEnd: handleDragEnd,
		threshold: commitThreshold,
		minVelocity: 0.45,
		disabled: loading || isRefreshingLatest
	});

	const fontClass =
		font === 'bookerly'
			? 'font-bookerly'
			: font === 'merriweather'
				? 'font-merriweather'
				: font === 'lora'
					? 'font-lora'
					: font === 'charter'
						? 'font-charter'
						: font === 'palatino'
							? 'font-palatino'
							: font === 'font_viet_tay'
								? 'font-viet-tay'
								: 'font-default';

	if (loading && !contentData) {
		return (
			<div className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden ${fontClass}`}>
				{/* Top Ambient Lighting Glow */}
				<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />

				{/* Header Skeleton */}
				<div className="px-4 py-3.5 border-b border-outline-variant/20 flex items-center justify-between opacity-70">
					<div className="h-4 w-36 skeleton-shimmer rounded-md" />
					<div className="h-6 w-6 skeleton-shimmer rounded-full" />
				</div>

				{/* Multi-layer Chapter Skeleton Body */}
				<ReaderChapterSkeleton />
			</div>
		);
	}

	if (error || !contentData) {
		return (
			<div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
				<PullToRefresh onRefresh={handlePullRefresh} disabled={loading || isRefreshingLatest} showIndicator={false} />
				<AlertCircle size={40} className="text-error mb-3" />
				<h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải chương</h2>
				<p className="text-xs text-on-surface-variant max-w-xs mb-5">{error || 'Chương không tồn tại'}</p>

				<div className="flex items-center justify-center gap-3">
					<button
						onClick={loadChapter}
						className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
					>
						<RotateCcw size={14} />
						<span>Thử tải lại</span>
					</button>

					<button
						onClick={() => navigate('/')}
						className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
					>
						<Home size={14} />
						<span>Về Trang chủ</span>
					</button>
				</div>
			</div>
		);
	}

	const { chapter, navigation } = contentData;
	const currentViewingTitle = activeChapter?.title || chapter.title;
	const currentViewingNumber = activeChapter?.chapterNumber ?? chapter.chapterNumber;

	const chapterDisplayLabel = displayChapters.length > 1 ? `${displayChapters[0].chapterNumber} - ${displayChapters[displayChapters.length - 1].chapterNumber}` : undefined;

	return (
		<div
			className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden hide-scrollbar no-scrollbar transition-colors duration-200 selection:bg-primary/25 selection:text-primary ${fontClass}`}
		>
			{/* Pull-to-refresh clear-cache gesture */}
			<PullToRefresh onRefresh={handlePullRefresh} disabled={loading || isRefreshingLatest} showIndicator={false} />

			{/* Subtle Top Ambient Lighting Glow */}
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />

			{/* Sticky Header - ALWAYS VISIBLE */}
			<ReaderHeader
				bookId={bookId || ''}
				bookName={chapter.bookName}
				chapterNumber={currentViewingNumber}
				chapterTitle={currentViewingTitle}
				progress={scrollProgress}
				isVisible={true}
				isTTSActive={isTTSActive}
				isRefreshingLatest={isRefreshingLatest}
				onToggleTTS={() => (isTTSActive ? handleStopTTS() : startReading())}
				onOpenHistory={handleOpenHistory}
				onTitleClick={handleTitleSingleClick}
				onTitleDoubleClick={handleTitleDoubleClick}
			/>

			{/* Floating Vertical Audio Menu Dock on Left Edge */}
			<VerticalBatchChapterNav
				chapters={displayChapters}
				activeChapterId={activeChapter?.chapterId}
				isVisible={showZenControls && (showTTSControlOnReader || isTTSActive || hasEdgeReadAloud)}
				isTTSActive={isTTSActive}
				isTTSLoading={isTTSLoading}
				isTTSPlaying={isPlaying}
				isBgmActive={isBgmPlaying}
				showTTSControl={showTTSControlOnReader}
				onToggleBgm={handleToggleBgm}
				currentParagraphIndex={activeParagraphIndex}
				onToggleTTS={() => (isTTSActive ? handleStopTTS() : startReading())}
				onTTSPlay={startReading}
				onTTSPause={pauseReading}
				onTTSStop={handleStopTTS}
				onTTSPrev={prevSection}
				onTTSNext={nextSection}
			/>

			{/* Reader Content Article - Frozen Memoized Multi-Chapter Section with Tap-to-Toggle Dock */}
			<div className="relative w-full overflow-hidden">
				{/* Lớp Skeleton nền (Underlay) hé lộ khi người dùng đang kéo vuốt (Interactive Peek) */}
				{isDragging && (
					<div
						aria-hidden="true"
						className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-90 transition-opacity duration-150"
					>
						<ReaderChapterSkeleton titleHint={pendingTitleHint} />
					</div>
				)}

				{/* Khung nội dung chính với chuyển động trượt mượt mà */}
				<div ref={readerContentRef} className="w-full will-change-transform relative z-10 bg-background">
					{isChapterLoading ? (
						<motion.div
							key={`loading-skeleton-${chapterId}`}
							initial={{ opacity: 0.6 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.12 }}
							className="w-full bg-background"
						>
							<ReaderChapterSkeleton titleHint={pendingTitleHint} />
						</motion.div>
					) : (
						<motion.div
							key={`${chapter.chapterId}-${domResetKey}`}
							initial={{
								opacity: swipeDirection ? 0.4 : 0.9,
								x: swipeDirection === 'left' ? 24 : swipeDirection === 'right' ? -24 : 0
							}}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
							className="w-full"
						>
							<ChapterContentSection
								chapters={displayChapters}
								fontSize={fontSize}
								lineHeight={lineHeight}
								isPlaying={isPlaying}
								isPaused={isPaused}
								currentParagraphIndex={activeParagraphIndex}
								onDoubleClick={handleDoubleClick}
								onTouchStart={handleTouchStart}
								onTouchEnd={handleTouchEnd}
							/>
						</motion.div>
					)}
				</div>
			</div>

			{/* Single Capsule Zen Mode Floating Control Bar */}
			<div aria-hidden="true">
				<ReaderQuickControl
					bookId={bookId || ''}
					currentChapterId={chapterId}
					prevChapterId={navigation?.prev?.chapterId || undefined}
					nextChapterId={navigation?.next?.chapterId || undefined}
					currentChapterNumber={currentViewingNumber}
					chapterDisplayLabel={chapterDisplayLabel}
					chapters={displayChapters}
					activeChapterId={activeChapter?.chapterId}
					isVisible={showZenControls}
					onOpenChapterSelect={handleOpenChapterSelect}
					onOpenTranslation={handleOpenTranslation}
				/>
			</div>

			{/* Modals & Sheets (aria-hidden="true" for screen readers / read aloud tools) */}
			<div aria-hidden="true">
				<GlobalSettingsSheet currentBookId={bookId} currentChapterId={chapterId} />

				{showTypographySheet && <QuickTypographySheet onClose={() => setShowTypographySheet(false)} />}

				{showChapterSelectSheet && (
					<QuickChapterSelectSheet
						bookId={bookId || ''}
						currentChapterId={activeChapter?.chapterId || chapterId}
						currentChapterNumber={activeChapter?.chapterNumber ?? chapter.chapterNumber}
						onClose={() => setShowChapterSelectSheet(false)}
					/>
				)}

				{showHistorySheet && <QuickBookHistorySheet currentBookId={bookId} onClose={() => setShowHistorySheet(false)} />}

				{showTranslateSheet && (
					<TranslationSheet
						currentBookId={bookId}
						currentChapterId={chapterId}
						currentChapterName={chapter.title}
						currentChapterNumber={chapter.chapterNumber}
						initialTab="batch_chapter"
						initialSelectedChapters={displayChapters.length > 0 ? displayChapters.map((c) => c.chapterId) : chapterId ? [chapterId] : []}
						onClose={() => setShowTranslateSheet(false)}
						onSuccess={loadChapter}
					/>
				)}
			</div>

			{/* Floating Selection Speaker Tooltip for Speaking from Selected Word/Sentence */}
			<SelectionSpeakerTooltip isTTSActive={isTTSActive} onSpeak={handleSelectionSpeak} />

			{/* Visual Touch Double-Tap Ripple Feedback */}
			{ripple && (
				<span
					key={ripple.id}
					onAnimationEnd={() => setRipple(null)}
					className="pointer-events-none fixed z-[99999] w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60 bg-primary/20 animate-ripple"
					style={{ left: ripple.x, top: ripple.y }}
				/>
			)}
		</div>
	);
}
