import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { Book, Chapter } from '../../../shared/types';
import { X, Download, Search, RefreshCw, Trash2, Sparkles } from 'lucide-react';
import { ChapterItem } from '../../chapter-list/components/ChapterItem';
import { downloadManager } from '../../../lib/DownloadManager';
import { useToastStore } from '../../../stores/useToastStore';
import { useAppStore } from '../../../stores/useAppStore';
import { offlineDb } from '../../../lib/offlineDb';
import { TranslationSheet } from '../../../components/TranslationSheet';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { BottomSheet } from '../../../components/BottomSheet';
import { openChapter } from '../../../shared/utils/openChapter';

interface QuickBookSheetProps {
  book: Book;
  onClose: () => void;
}

export function QuickBookSheet({ book, onClose }: QuickBookSheetProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showTranslationSheet, setShowTranslationSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBottom, setLoadingBottom] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);

  const [hasMoreTop, setHasMoreTop] = useState(false);
  const [hasMoreBottom, setHasMoreBottom] = useState(true);
  const [minChapterNum, setMinChapterNum] = useState<number>(1);
  const [maxChapterNum, setMaxChapterNum] = useState<number>(1);
  const [search, setSearch] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialScrollDoneRef = useRef(false);
  const pendingPrependScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    offlineDb.getBook(book.bookId).then((b) => setIsDownloaded(Boolean(b)));
  }, [book.bookId]);

  const handleDownloadBook = () => {
    downloadManager.addBook(book.bookId, book.bookName);
    showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
    onClose();
  };

  const handleDeleteOfflineBook = async () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${book.bookName}" khỏi máy?`)) {
      await offlineDb.deleteBook(book.bookId);
      setIsDownloaded(false);
      showToast(`Đã xóa "${book.bookName}" khỏi máy`, 'success');
      window.dispatchEvent(new CustomEvent('app-refresh'));
      onClose();
    }
  };

  const percent = book.chapterCount > 0 ? Math.round((book.totalTranslated / book.chapterCount) * 100) : 0;
  const pendingCount = book.totalPending || Math.max(0, book.chapterCount - book.totalTranslated);

  // Load initial chapters windowed around lastReadChapterNumber
  const loadInitialChapters = useCallback(
    async (searchQuery: string = '') => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      isInitialScrollDoneRef.current = false;

      const targetChapter = book.lastReadChapter?.chapterNumber
        ? Math.max(1, Number(book.lastReadChapter.chapterNumber))
        : 1;

      // Smart windowing: If targetChapter is near the end, backfill before it to always load enough chapters
      const totalChapters = book.chapterCount || 0;
      const remainingAhead = totalChapters > 0 ? Math.max(0, totalChapters - targetChapter) : 0;
      const neededBehind = Math.max(5, configChapterLimit - remainingAhead);

      const startChapterNumber = searchQuery
        ? undefined
        : Math.max(1, targetChapter - neededBehind);

      const endChapterNumber = searchQuery
        ? undefined
        : targetChapter + configChapterLimit;

      try {
        const res = await ChapterRepository.getChapters(
          book.bookId,
          1,
          configChapterLimit + 10,
          'chapterNumber',
          'ASC',
          'all',
          searchQuery,
          startChapterNumber,
          endChapterNumber
        );

        if (fetchId !== fetchIdRef.current) return;

        const newChapters = res.chapters || [];
        setChapters(newChapters);

        if (newChapters.length > 0) {
          const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
          const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
          setMinChapterNum(minNum);
          setMaxChapterNum(maxNum);
          setHasMoreTop(!searchQuery && minNum > 1);
          setHasMoreBottom(maxNum < (book.chapterCount || 999999) && newChapters.length >= configChapterLimit);
        } else {
          setHasMoreTop(false);
          setHasMoreBottom(false);
        }
      } catch {
        // Ignore error
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [book.bookId, book.lastReadChapter, book.chapterCount, configChapterLimit]
  );

  useEffect(() => {
    loadInitialChapters('');
  }, [loadInitialChapters]);

  // Auto-backfill previous chapters if initial viewport has extra space and hasMoreTop is true
  useEffect(() => {
    if (!loading && !loadingTop && hasMoreTop && isInitialScrollDoneRef.current && scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
        fetchPrevTopPage();
      }
    }
  }, [loading, loadingTop, hasMoreTop, chapters.length]);

  // Auto-scroll positioning active chapter directly visible
  const scrollToActive = useCallback(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeEl = activeItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
      container.scrollTop = Math.max(0, targetScrollTop);
    }
  }, []);

  // Synchronous scroll compensation after prepending items to top (Runs BEFORE browser paint)
  useLayoutEffect(() => {
    if (pendingPrependScrollRef.current && scrollContainerRef.current) {
      const { prevHeight, prevTop } = pendingPrependScrollRef.current;
      pendingPrependScrollRef.current = null;
      const newHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = prevTop + (newHeight - prevHeight);
    }
  }, [chapters]);

  useLayoutEffect(() => {
    if (!loading && chapters.length > 0 && !isInitialScrollDoneRef.current) {
      isInitialScrollDoneRef.current = true;
      requestAnimationFrame(() => {
        scrollToActive();
      });
    }
  }, [loading, chapters, scrollToActive]);

  // Fetch next bottom chapters starting from maxChapterNum + 1 (Scroll Down)
  const fetchNextBottomPage = async () => {
    if (loadingBottom || !hasMoreBottom || search || !isInitialScrollDoneRef.current) return;
    setLoadingBottom(true);
    const targetFromChapter = maxChapterNum + 1;

    try {
      const res = await ChapterRepository.getChapters(
        book.bookId,
        1,
        configChapterLimit,
        'chapterNumber',
        'ASC',
        'all',
        search,
        targetFromChapter
      );

      const newChapters = res.chapters || [];

      if (newChapters.length > 0) {
        setChapters((prev) => {
          const existingIds = new Set(prev.map((c) => c.chapterId));
          const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
          return [...prev, ...uniqueNew];
        });
        const newMax = Math.max(...newChapters.map((c) => c.chapterNumber));
        setMaxChapterNum(newMax);
        setHasMoreBottom(newChapters.length >= configChapterLimit);
      } else {
        setHasMoreBottom(false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingBottom(false);
    }
  };

  // Fetch previous top chapters before minChapterNum (Scroll Up)
  const fetchPrevTopPage = async () => {
    if (loadingTop || !hasMoreTop || minChapterNum <= 1 || search || !isInitialScrollDoneRef.current) return;
    setLoadingTop(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;
    const targetToChapter = minChapterNum - 1;
    const targetFromChapter = Math.max(1, minChapterNum - configChapterLimit);

    try {
      const res = await ChapterRepository.getChapters(
        book.bookId,
        1,
        configChapterLimit,
        'chapterNumber',
        'ASC',
        'all',
        search,
        targetFromChapter,
        targetToChapter
      );

      const newChapters = res.chapters || [];

      if (newChapters.length > 0) {
        if (container) {
          pendingPrependScrollRef.current = {
            prevHeight: prevScrollHeight,
            prevTop: prevScrollTop,
          };
        }

        setChapters((prev) => {
          const existingIds = new Set(prev.map((c) => c.chapterId));
          const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
          return [...uniqueNew, ...prev];
        });

        const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
        setMinChapterNum(newMin);
        setHasMoreTop(newMin > 1);
      } else {
        setHasMoreTop(false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTop(false);
    }
  };

  // Scroll handler for 2-way Infinite Scroll (Top & Bottom)
  const handleScroll = () => {
    if (!scrollContainerRef.current || loading || !isInitialScrollDoneRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;

    // Scroll Down -> Load More Bottom (Prefetch early at 300px threshold)
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      fetchNextBottomPage();
    }

    // Scroll Up -> Load More Top (Only when user actually scrolls near top <= 80px)
    if (scrollTop <= 80) {
      fetchPrevTopPage();
    }
  };

  // Debounced API Search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadInitialChapters(val);
    }, 300);
  };

  const handleSelectChapter = (chapterId: string) => {
    onClose();
    openChapter(book.bookId, chapterId);
  };

  return (
    <>
      <BottomSheet
        isOpen={true}
        onClose={onClose}
        ariaLabel={book.bookName}
        maxHeight="h-[82vh] max-h-[90dvh]"
        showDragHandle={false}
      >
        {/* Top Header & Compact Mobile Info Area (Includes Drag Handle for 100% seamless unified background) */}
        <div className="pt-2 px-3.5 pb-1.5 border-b border-white/10 space-y-1.5 flex-shrink-0 bg-transparent relative z-20">
          {/* Drag Handle */}
          <div className="w-8 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-1 flex-shrink-0" />

          {/* Row 1: Title + Action Icon Buttons */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-on-surface tracking-tight leading-snug truncate flex-1 min-w-0">
              {book.bookName}
            </h2>

            {/* Action Icon Group (Compact p-1 buttons) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* AI Batch Translation icon button with pending badge */}
              {!isOfflineMode && (
                <button
                  type="button"
                  onClick={() => setShowTranslationSheet(true)}
                  className="relative p-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-primary hover:bg-white/20 transition-all flex items-center justify-center active:scale-95"
                  title={pendingCount > 0 ? `Chờ dịch: ${pendingCount} chương (Mở Dịch AI)` : 'Mở Dịch AI'}
                >
                  <Sparkles size={15} className={pendingCount > 0 ? 'text-primary animate-pulse' : ''} />
                  {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-0.5 rounded-full bg-primary text-on-primary font-mono font-black text-[7.5px] flex items-center justify-center leading-none shadow-xs">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </button>
              )}

              {/* Download / Delete icon button */}
              {isDownloaded ? (
                <button
                  onClick={handleDeleteOfflineBook}
                  className="p-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-rose-400 hover:text-rose-300 hover:bg-white/20 transition-all flex items-center justify-center active:scale-95"
                  title="Xóa truyện khỏi máy"
                >
                  <Trash2 size={15} />
                </button>
              ) : !isOfflineMode ? (
                <button
                  onClick={handleDownloadBook}
                  className="p-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all flex items-center justify-center active:scale-95"
                  title="Tải về ngoại tuyến"
                >
                  <Download size={15} />
                </button>
              ) : null}

              {/* Close modal button */}
              <button
                onClick={onClose}
                className="p-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all flex items-center justify-center ml-0.5 active:scale-95"
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Row 2: Progress Stat & Bar */}
          <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant/80">
            <span>Đã dịch: <b className="text-on-surface">{book.totalTranslated}/{book.chapterCount}</b> ch ({percent}%)</span>
            <div className="w-16 bg-white/10 border border-white/15 h-1 rounded-full overflow-hidden ml-2 shrink-0">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Row 3: Tags List (Wrapping flex, zero horizontal scroll) */}
          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-white/10 border border-white/15 text-on-surface-variant shrink-0"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Row 3: Compact Search Bar */}
          <div className="relative pt-0.5">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Tìm nhanh số hoặc tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 font-medium transition-all"
            />
          </div>
        </div>

        {/* Inline Chapter List Container with 2-way Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-1.5"
        >
          {/* Scroll Up Top Loading Indicator */}
          {loadingTop && (
            <div className="space-y-1.5 mb-2">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={`sk-top-${idx}`} className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-between">
                  <div className="h-4 w-36 bg-on-surface-variant/20 rounded" />
                  <div className="h-4 w-12 bg-primary/20 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {loading && chapters.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-on-surface-variant">
              <RefreshCw size={20} className="animate-spin text-primary mx-auto" />
              <p className="text-xs font-medium">Đang tải danh sách chương...</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">
              Không tìm thấy chương nào
            </div>
          ) : (
            <>
              {chapters.map((c, idx) => {
                const isLastRead = book.lastReadChapter?.chapterId === c.chapterId;

                return (
                  <ChapterItem
                    key={c.chapterId || `chap-${c.chapterNumber || idx}-${idx}`}
                    ref={isLastRead ? activeItemRef : null}
                    chapter={c}
                    isActive={isLastRead}
                    onClick={() => handleSelectChapter(c.chapterId)}
                  />
                );
              })}

              {/* Scroll Down Bottom Loading Indicator */}
              {loadingBottom && (
                <div className="space-y-1.5 mt-2">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div key={`sk-bottom-${idx}`} className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-between">
                      <div className="h-4 w-36 bg-on-surface-variant/20 rounded" />
                      <div className="h-4 w-12 bg-primary/20 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </BottomSheet>

      {/* Batch AI Translation Modal Sheet */}
      {showTranslationSheet && (
        <TranslationSheet
          currentBookId={book.bookId}
          currentBookName={book.bookName}
          initialTab="batch_chapter"
          disableCurrent={true}
          onClose={() => setShowTranslationSheet(false)}
        />
      )}
    </>
  );
}
