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
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { TranslationSheet } from '../../components/TranslationSheet';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { offlineDb } from '../../lib/offlineDb';
import { AlertCircle } from 'lucide-react';

interface ChapterContentSectionProps {
  chapters: ChapterDetailItem[];
  fontSize: number;
  lineHeight: number;
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraphIndex: number;
  onDoubleClick: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
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
  onClick,
}: ChapterContentSectionProps) {
  return (
    <main id="main-story-content" onClick={onClick} className="pt-20 pb-20">
      {chapters.map((chap, chapIdx) => (
        <section
          key={chap.chapterId || chapIdx}
          id={`chapter-section-${chap.chapterId}`}
          data-chapter-id={chap.chapterId}
          data-chapter-number={chap.chapterNumber}
          data-chapter-title={chap.title}
          className="chapter-block-section scroll-mt-16 mb-0"
        >
          {/* Subtle Aesthetic Divider between chapters in batch */}
          {chapIdx > 0 && (
            <div className="mt-3 mb-2 px-4 flex items-center gap-3 select-none">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-outline-variant/40 to-transparent" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-outline-variant/40 to-transparent" />
            </div>
          )}

          {/* Chapter Section Title with Accent Indicator */}
          <div className="px-4 mb-2 pt-0.5">
            <h2 className="text-base sm:text-lg font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary inline-block shrink-0" />
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
            {chap.content.map((paragraphHtml, index) => (
              <ParagraphView
                key={`${chap.chapterId}-${index}`}
                index={index}
                content={paragraphHtml}
                isTTSActive={(isPlaying || isPaused) && currentParagraphIndex === index}
                onDoubleClick={onDoubleClick}
              />
            ))}
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

  /* READ ALOUD (TTS) TEMPORARILY DISABLED */
  const isPlaying = false;
  const isPaused = false;
  const currentParagraphIndex = -1;

  const [contentData, setContentData] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Throttled & Smooth scroll progress listener for Dock & Progress bar
  useEffect(() => {
    const handleScroll = () => {
      if (scrollAnimRef.current !== null) return;
      scrollAnimRef.current = requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          const newProgress = (currentY / totalHeight) * 100;
          setScrollProgress((prev) => (Math.abs(prev - newProgress) > 0.5 ? newProgress : prev));

          // Auto show controls when user reaches bottom of page
          const isNearBottom = currentY >= totalHeight - 60 || newProgress >= 95;
          if (isNearBottom) {
            setShowZenControls(true);
            lastScrollY.current = currentY;
            scrollAnimRef.current = null;
            return;
          }
        }

        if (currentY > lastScrollY.current + 40 && currentY > 100) {
          setShowZenControls(false);
        } else if (currentY < lastScrollY.current - 20) {
          setShowZenControls(true);
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
  }, []);

  // Tap/Click reading screen to toggle bottom dock control bar
  const handleArticleTap = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    setShowZenControls((prev) => !prev);
  }, []);

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

  // No-op double-click handler
  const handleDoubleClick = useCallback(() => {}, []);

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
    return <LoadingOverlay isLoading={true} message="Đang mở văn bản..." />;
  }

  if (error || !contentData) {
    return (
      <div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={40} className="text-error mb-3" />
        <h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải chương</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mb-5">{error || 'Chương không tồn tại'}</p>
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-extrabold"
        >
          Quay lại danh sách chương
        </button>
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
      className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200 ${fontClass}`}
    >
      {/* Smooth Non-Destructive Chapter Switching Loading Overlay */}
      <LoadingOverlay isLoading={loading} message="Đang mở văn bản..." />

      {/* Sticky Header - ALWAYS VISIBLE */}
      <div aria-hidden="true">
        <ReaderHeader
          bookId={bookId || ''}
          bookName={chapter.bookName}
          chapterNumber={currentViewingNumber}
          chapterTitle={currentViewingTitle}
          progress={scrollProgress}
          isVisible={true}
          onOpenHistory={handleOpenHistory}
        />
      </div>

      {/* Floating Vertical Chapter Circle Strip on Left Edge */}
      <VerticalBatchChapterNav
        chapters={displayChapters}
        activeChapterId={activeChapter?.chapterId}
        isVisible={showZenControls}
      />

      {/* Reader Content Article - Frozen Memoized Multi-Chapter Section with Tap-to-Toggle Dock */}
      <ChapterContentSection
        chapters={displayChapters}
        fontSize={fontSize}
        lineHeight={lineHeight}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentParagraphIndex={currentParagraphIndex}
        onDoubleClick={handleDoubleClick}
        onClick={handleArticleTap}
      />

      {/* Single Capsule Zen Mode Floating Control Bar */}
      <div aria-hidden="true">
        <ReaderQuickControl
          bookId={bookId || ''}
          prevChapterId={navigation?.prev?.chapterId || undefined}
          nextChapterId={navigation?.next?.chapterId || undefined}
          currentChapterNumber={currentViewingNumber}
          chapterDisplayLabel={chapterDisplayLabel}
          isVisible={showZenControls}
          isTTSActive={false}
          isTTSPlaying={false}
          currentParagraphIndex={-1}
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
            initialSelectedChapters={chapterId ? [chapterId] : []}
            onClose={() => setShowTranslateSheet(false)}
            onSuccess={loadChapter}
          />
        )}
      </div>
    </div>
  );
}
