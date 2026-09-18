import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../repositories/ChapterRepository';
import { ChapterContent, ChapterDetailItem } from '../../shared/types';
import { useReaderConfigStore } from '../../stores/useReaderConfigStore';
import { useAppStore } from '../../stores/useAppStore';
import { useToastStore } from '../../stores/useToastStore';
import { useTTSStore } from './stores/useTTSStore';
import { ReaderHeader } from './components/ReaderHeader';
import { ParagraphView } from './components/ParagraphView';
import { QuickReplacementModal } from './components/QuickReplacementModal';
import { ReaderQuickControl } from './components/ReaderQuickControl';
import { QuickTypographySheet } from './components/QuickTypographySheet';
import { QuickChapterSelectSheet } from './components/QuickChapterSelectSheet';
import { QuickBookHistorySheet } from './components/QuickBookHistorySheet';
import { VerticalBatchChapterNav } from './components/VerticalBatchChapterNav';
import { TranslationSheet } from '../../components/TranslationSheet';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import { useReadAloud } from '../../hooks/useReadAloud';
import { offlineDb } from '../../lib/offlineDb';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

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
  onTouchEnd,
}: ChapterContentSectionProps) {
  const paragraphOffsets = chapters.map((_, chapterIndex) =>
    chapters
      .slice(0, chapterIndex)
      .reduce((total, chapter) => total + chapter.content.length, 0)
  );

  return (
    <main
      id="main-story-content"
      onDoubleClick={onDoubleClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="pt-20 pb-20 select-text relative z-10"
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
              <span>
                {chap.title?.toLowerCase().startsWith('chương')
                  ? chap.title
                  : `Chương ${chap.chapterNumber}: ${chap.title}`}
              </span>
            </h2>
          </div>

          {/* Chapter Paragraphs */}
          <article
            className="px-4 select-text"
            style={{ fontSize: `${fontSize}px`, lineHeight }}
          >
            {chap.content.map((paragraphHtml, index) => {
              const paragraphIndex = paragraphOffsets[chapIdx] + index;
              return (
                <ParagraphView
                  key={`${chap.chapterId}-${index}`}
                  index={paragraphIndex}
                  content={paragraphHtml}
                  isTTSActive={
                    (isPlaying || isPaused) && currentParagraphIndex === paragraphIndex
                  }
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

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
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
  const [error, setError] = useState<string | null>(null);

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
        chapterId: chap.chapterId,
        chapterNumber: chap.chapterNumber,
      }))
    );
  }, [bookId, displayChapters]);

  const {
    isPlaying,
    isPaused,
    isLoading: isTTSLoading,
    currentChunkIndex,
    activeParagraphIndex,
    startReading,
    pauseReading,
    stopReading,
    nextSection,
    prevSection,
  } = useReadAloud(allParagraphs, {
    bookId: bookId || displayChapters[0]?.bookId,
    chapterId: chapterId || displayChapters[0]?.chapterId,
    chapterNumber: displayChapters[0]?.chapterNumber,
  }, paragraphChapterContexts);

  // Keep single global LoadingOverlay active until chapter data is rendered in React state
  useGlobalLoading(loading);

  // Sync document.title with the current reading story name
  useDocumentTitle(contentData?.chapter?.bookName);

  // Clean Reading Progress & Scroll Restoration
  const isContentReady = !loading && contentData !== null;
  useReadingProgress(bookId, chapterId, isContentReady);

  const [showTranslateSheet, setShowTranslateSheet] = useState(false);
  const [showTypographySheet, setShowTypographySheet] = useState(false);
  const [showChapterSelectSheet, setShowChapterSelectSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

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
        title: displayChapters[0].title,
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
              title: chapTitle,
            });
          }
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

  // Sync active reading chapter to local book history
  useEffect(() => {
    if (!activeChapter || !bookId) return;
    offlineDb.getBook(bookId).then((b) => {
      if (b) {
        b.lastReadChapter = {
          chapterId: activeChapter.chapterId,
          chapterNumber: activeChapter.chapterNumber,
          title: activeChapter.title,
        };
        b.lastedReadAt = new Date().toISOString();
        offlineDb.saveBook(b);
      }
    });
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

  // Record touch start coordinates to measure movement distance on touchEnd
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, []);

  // Single unified toggle with 400ms lock to eliminate duplicate touch + dblclick flickering
  const toggleZenControls = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 400) return;
    lastToggleTimeRef.current = now;
    setShowZenControls((prev) => !prev);
  }, []);

  // Case 2: Double click / Double tap on reading screen to toggle bottom dock
  const handleDoubleClick = useCallback((e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    toggleZenControls();
  }, [toggleZenControls]);

  const handleTouchEnd = useCallback((e?: React.TouchEvent) => {
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

    touchStartPosRef.current = null;

    if (isMoved) {
      lastTapTimeRef.current = 0;
      return;
    }

    if (now - lastTapTimeRef.current < 350 && now - lastTapTimeRef.current > 40) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      toggleZenControls();
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  }, [toggleZenControls]);

  // Fetch chapter data with smooth 200ms loading feedback
  const loadChapter = useCallback(async () => {
    if (!chapterId) return;
    const MIN_LOADING_TIME = 200;
    const startTime = Date.now();
    setLoading(true);
    setError(null);
    try {
      const effectiveBatchSize = batchChapterSize;
      const res = await ChapterRepository.getChapterContent(
        chapterId,
        groupLines,
        isEnabledReplace,
        '',
        effectiveBatchSize
      );
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime));
      }
      setContentData(res);
    } catch (e: any) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime));
      }
      setError(e.message || 'Lỗi khi tải nội dung chương');
    } finally {
      setLoading(false);
    }
  }, [chapterId, groupLines, isEnabledReplace, batchChapterSize, isOfflineMode]);

  useEffect(() => {
    loadChapter();
  }, [chapterId, loadChapter]);

  const handleOpenHistory = useCallback(() => setShowHistorySheet(true), []);
  const handleOpenChapterSelect = useCallback(() => setShowChapterSelectSheet(true), []);
  const handleOpenTranslation = useCallback(() => setShowTranslateSheet(true), []);

  const fontClass =
    font === 'font_viet_tay'
      ? 'font-mono'
      : font === 'default'
      ? 'font-sans'
      : 'font-serif';

  if (loading && !contentData) {
    return (
      <div className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden ${fontClass}`}>
        {/* Header Skeleton */}
        <div className="px-4 py-3.5 border-b border-outline-variant/20 flex items-center justify-between opacity-60">
          <div className="h-4 w-36 bg-on-surface-variant/20 rounded-md animate-pulse" />
          <div className="h-6 w-6 bg-on-surface-variant/20 rounded-full animate-pulse" />
        </div>

        {/* Paragraph Content Skeleton Lines */}
        <div className="p-4 space-y-4 opacity-50">
          <div className="h-5 w-52 bg-primary/30 rounded-md animate-pulse mb-6" />
          <div className="space-y-2.5">
            <div className="h-3.5 w-full bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[94%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[98%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[88%] bg-on-surface-variant/20 rounded animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-3">
            <div className="h-3.5 w-[96%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[92%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[95%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[85%] bg-on-surface-variant/20 rounded animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-3">
            <div className="h-3.5 w-[98%] bg-on-surface-variant/20 rounded animate-pulse" />
            <div className="h-3.5 w-[90%] bg-on-surface-variant/20 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !contentData) {
    return (
      <div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
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

  const chapterDisplayLabel =
    displayChapters.length > 1
      ? `${displayChapters[0].chapterNumber} - ${displayChapters[displayChapters.length - 1].chapterNumber}`
      : undefined;

  return (
    <div
      className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200 selection:bg-primary/25 selection:text-primary ${fontClass}`}
    >
      {/* Subtle Top Ambient Lighting Glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />

      {/* Sticky Header - ALWAYS VISIBLE */}
      <div aria-hidden="true">
        <ReaderHeader
          bookId={bookId || ''}
          bookName={chapter.bookName}
          chapterNumber={currentViewingNumber}
          chapterTitle={currentViewingTitle}
          progress={scrollProgress}
          isVisible={true}
          isTTSActive={isPlaying || isPaused}
          onToggleTTS={() => (isPlaying || isPaused || isTTSLoading ? stopReading() : startReading())}
          onOpenHistory={handleOpenHistory}
        />
      </div>

      {/* Floating Vertical Audio Menu Dock on Left Edge */}
      <VerticalBatchChapterNav
        chapters={displayChapters}
        activeChapterId={activeChapter?.chapterId}
        isVisible={showZenControls && (showTTSControlOnReader || isPlaying || isPaused || isTTSLoading)}
        isTTSActive={isPlaying || isPaused}
        isTTSLoading={isTTSLoading}
        isTTSPlaying={isPlaying}
        currentParagraphIndex={activeParagraphIndex}
        onToggleTTS={() => (isPlaying || isPaused || isTTSLoading ? stopReading() : startReading())}
        onTTSPlay={startReading}
        onTTSPause={pauseReading}
        onTTSStop={stopReading}
        onTTSPrev={prevSection}
        onTTSNext={nextSection}
      />

      {/* Reader Content Article - Frozen Memoized Multi-Chapter Section with Tap-to-Toggle Dock */}
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

      {/* Single Capsule Zen Mode Floating Control Bar */}
      <div aria-hidden="true">
        <ReaderQuickControl
          bookId={bookId || ''}
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

        {showTypographySheet && (
          <QuickTypographySheet onClose={() => setShowTypographySheet(false)} />
        )}

        {showChapterSelectSheet && (
          <QuickChapterSelectSheet
            bookId={bookId || ''}
            currentChapterId={activeChapter?.chapterId || chapterId}
            currentChapterNumber={activeChapter?.chapterNumber ?? chapter.chapterNumber}
            onClose={() => setShowChapterSelectSheet(false)}
          />
        )}

        {showHistorySheet && (
          <QuickBookHistorySheet
            currentBookId={bookId}
            onClose={() => setShowHistorySheet(false)}
          />
        )}

        {showTranslateSheet && (
          <TranslationSheet
            currentBookId={bookId}
            currentChapterId={chapterId}
            currentChapterName={chapter.title}
            currentChapterNumber={chapter.chapterNumber}
            initialTab="batch_chapter"
            initialSelectedChapters={
              displayChapters.length > 0
                ? displayChapters.map((c) => c.chapterId)
                : chapterId
                ? [chapterId]
                : []
            }
            onClose={() => setShowTranslateSheet(false)}
            onSuccess={loadChapter}
          />
        )}
      </div>
    </div>
  );
}
