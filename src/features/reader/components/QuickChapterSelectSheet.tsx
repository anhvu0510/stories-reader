import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { Chapter } from '../../../shared/types';
import { X, Search, Clock, RefreshCw, Download, Trash2 } from 'lucide-react';
import { ChapterItem } from '../../chapter-list/components/ChapterItem';
import { downloadManager, DownloadTask } from '../../../lib/DownloadManager';
import { offlineDb } from '../../../lib/offlineDb';
import { useToastStore } from '../../../stores/useToastStore';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { BottomSheet } from '../../../components/BottomSheet';
import { openChapter } from '../../../shared/utils/openChapter';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../../hooks/useHaptic';

function ChapterSkeletonItem() {
  return (
    <div className="w-full p-3 rounded-2xl bg-white/5 dark:bg-white/[0.04] border border-white/10 flex items-center gap-3 animate-pulse">
      <div className="w-12 h-7 rounded-xl bg-on-surface-variant/15 flex-shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="h-4 w-3/4 bg-on-surface-variant/20 rounded-md" />
        <div className="h-3 w-1/3 bg-on-surface-variant/15 rounded-md" />
      </div>
      <div className="w-8 h-8 rounded-full bg-on-surface-variant/15 flex-shrink-0" />
    </div>
  );
}

interface QuickChapterSelectSheetProps {
  bookId: string;
  bookName?: string;
  currentChapterId?: string;
  currentChapterNumber?: number;
  onClose: () => void;
}

export function QuickChapterSelectSheet({
  bookId,
  currentChapterId,
  currentChapterNumber,
  onClose,
}: QuickChapterSelectSheetProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadTask, setDownloadTask] = useState<DownloadTask | undefined>(() => downloadManager.getTask(bookId));

  // 100% Lock body & html scroll while modal sheet is open to prevent background reader screen from scrolling
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    offlineDb.getBook(bookId).then((b) => setIsDownloaded(Boolean(b)));

    const updateTask = () => {
      setDownloadTask(downloadManager.getTask(bookId));
      offlineDb.getBook(bookId).then((b) => setIsDownloaded(Boolean(b)));
    };

    updateTask();
    const unsubscribe = downloadManager.subscribe(updateTask);
    window.addEventListener('download-queue-updated', updateTask);

    return () => {
      unsubscribe();
      window.removeEventListener('download-queue-updated', updateTask);
    };
  }, [bookId]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDownloadBook = () => {
    const targetBookName = chapters[0]?.bookName || 'Truyện';
    downloadManager.addBook(bookId, targetBookName);
    showToast(`Đã thêm vào hàng đợi tải xuống`, 'info');
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    const targetBookName = chapters[0]?.bookName || 'Truyện';
    await offlineDb.deleteBook(bookId);
    setIsDownloaded(false);
    showToast(`Đã xóa "${targetBookName}" khỏi máy`, 'success');
    window.dispatchEvent(new CustomEvent('app-refresh'));
  };
  const [chapters, setChapters] = useState<Chapter[]>([]);
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

  // Primary single API fetch handler starting from (currentChapterNumber - 5) to (currentChapterNumber + configChapterLimit)
  const loadInitialChapters = useCallback(
    async (searchQuery: string = '') => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      isInitialScrollDoneRef.current = false;
      const startChapterNumber = searchQuery
        ? undefined
        : currentChapterNumber
        ? Math.max(1, currentChapterNumber - 5)
        : 1;
      const endChapterNumber = searchQuery
        ? undefined
        : currentChapterNumber
        ? currentChapterNumber + configChapterLimit
        : undefined;

      try {
        const res = await ChapterRepository.getChapters(
          bookId,
          1,
          configChapterLimit,
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
          setHasMoreBottom(newChapters.length >= configChapterLimit);
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
    [bookId, currentChapterNumber, configChapterLimit]
  );

  // Initial mount - Calls API EXACTLY ONCE
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

  // Auto-scroll positioning active chapter comfortably in middle of viewport
  const scrollToActive = useCallback(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeEl = activeItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top) - (containerRect.height / 3);
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
        setTimeout(scrollToActive, 50);
        setTimeout(scrollToActive, 150);
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
        bookId,
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
        bookId,
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
    openChapter(bookId, chapterId);
  };

  return (
    <>
      <BottomSheet
        isOpen={true}
        onClose={onClose}
        ariaLabel="Danh Sách Chương"
        maxHeight="h-[78vh] max-h-[85dvh]"
        showDragHandle={false}
      >
        {/* Header & Search (Includes Drag Handle for 100% seamless unified background) */}
        <div className="pt-2.5 px-4 pb-2 border-b border-white/10 space-y-2 flex-shrink-0 bg-transparent relative z-20">
          {/* Drag Handle */}
          <div className="w-10 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-1.5 flex-shrink-0" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-on-surface tracking-tight">Danh Sách Chương</h3>
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  if (isDownloaded) {
                    triggerHaptic('warning');
                    setShowDeleteConfirm(true);
                  } else {
                    triggerHaptic('light');
                    handleDownloadBook();
                  }
                }}
                disabled={Boolean(downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting'))}
                title={isDownloaded ? "Xóa dữ liệu ngoại tuyến" : "Tải bộ truyện về đọc offline"}
                aria-label={isDownloaded ? "Xóa dữ liệu ngoại tuyến" : "Tải bộ truyện về đọc offline"}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDownloaded
                    ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                    : downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting')
                    ? "text-primary bg-primary/10"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-white/10"
                }`}
              >
                {downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting') ? (
                  <RefreshCw size={16} className="animate-spin text-primary" />
                ) : isDownloaded ? (
                  <Trash2 size={16} />
                ) : (
                  <Download size={16} />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="w-9 h-9 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                title="Đóng"
                aria-label="Đóng bảng chọn chương"
              >
                <X size={18} />
              </motion.button>
            </div>
          </div>

          <div className="relative pt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm nhanh số hoặc tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 border border-white/15 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] text-sm sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 font-medium transition-all"
            />
            {search && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSearch('');
                  loadInitialChapters('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                title="Xóa tìm kiếm"
              >
                <X size={13} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Chapter List with Windowing 2-way Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-1.5"
        >
          {/* Scroll Up Top Loading Indicator */}
          {loadingTop && (
            <div className="space-y-2 mb-2">
              {[1, 2, 3, 4, 5].map((idx) => (
                <ChapterSkeletonItem key={`sk-top-${idx}`} />
              ))}
            </div>
          )}

          {loading && chapters.length === 0 ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                <ChapterSkeletonItem key={`sk-init-${idx}`} />
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant font-medium">
              Không tìm thấy chương nào
            </div>
          ) : (
            <>
              {chapters.map((c, idx) => {
                const isCurrent = Boolean(
                  (currentChapterId && c.chapterId === currentChapterId) ||
                  (currentChapterNumber !== undefined && c.chapterNumber === currentChapterNumber)
                );

                return (
                  <ChapterItem
                    key={c.chapterId || `chap-${c.chapterNumber || idx}-${idx}`}
                    ref={isCurrent ? activeItemRef : null}
                    chapter={c}
                    isActive={isCurrent}
                    showStatus={true}
                    onClick={() => handleSelectChapter(c.chapterId)}
                  />
                );
              })}

              {/* Scroll Down Bottom Loading Indicator */}
              {loadingBottom && (
                <div className="space-y-2 mt-2">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <ChapterSkeletonItem key={`sk-bottom-${idx}`} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </BottomSheet>

      {/* Mobile Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[99990] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface/90 dark:bg-surface/90 backdrop-blur-2xl text-on-surface w-full max-w-xs sm:max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-on-surface">Xóa dữ liệu ngoại tuyến?</h3>
              <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                Xoá toàn bộ các chương đã tải về sẽ bị xóa khỏi máy.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  triggerHaptic('light');
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                Hủy
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  triggerHaptic('warning');
                  handleConfirmDelete();
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
              >
                Xóa khỏi máy
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
