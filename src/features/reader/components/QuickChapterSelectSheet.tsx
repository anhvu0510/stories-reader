import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { Chapter } from '../../../shared/types';
import { X, Search, Clock, RefreshCw, Download, Trash2 } from 'lucide-react';
import { ChapterItem } from '../../chapter-list/components/ChapterItem';
import { downloadManager, DownloadTask } from '../../../lib/DownloadManager';
import { offlineDb } from '../../../lib/offlineDb';
import { useToastStore } from '../../../stores/useToastStore';

interface QuickChapterSelectSheetProps {
  bookId: string;
  bookName?: string;
  currentChapterId?: string;
  currentChapterNumber?: number;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export function QuickChapterSelectSheet({
  bookId,
  currentChapterId,
  currentChapterNumber,
  onClose,
}: QuickChapterSelectSheetProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadTask, setDownloadTask] = useState<DownloadTask | undefined>(() => downloadManager.getTask(bookId));

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

  // Primary single API fetch handler starting from (currentChapterNumber - 5) to (currentChapterNumber + 20)
  const loadInitialChapters = useCallback(
    async (searchQuery: string = '') => {
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
        ? currentChapterNumber + 20
        : undefined;

      try {
        const res = await ChapterRepository.getChapters(
          bookId,
          1,
          26,
          'chapterNumber',
          'ASC',
          'all',
          searchQuery,
          startChapterNumber,
          endChapterNumber
        );

        const newChapters = res.chapters || [];
        setChapters(newChapters);

        if (newChapters.length > 0) {
          const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
          const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
          setMinChapterNum(minNum);
          setMaxChapterNum(maxNum);
          setHasMoreTop(!searchQuery && minNum > 1);
          setHasMoreBottom(newChapters.length >= 20);
        } else {
          setHasMoreTop(false);
          setHasMoreBottom(false);
        }
      } catch {
        // Ignore error
      } finally {
        setLoading(false);
      }
    },
    [bookId, currentChapterNumber]
  );

  // Initial mount - Calls API EXACTLY ONCE
  useEffect(() => {
    loadInitialChapters('');
  }, [loadInitialChapters]);

  // Auto-backfill previous chapters if initial viewport has extra space and hasMoreTop is true
  useEffect(() => {
    if (!loading && !loadingTop && hasMoreTop && scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
        fetchPrevTopPage();
      }
    }
  }, [loading, loadingTop, hasMoreTop, chapters.length]);

  // Auto-scroll positioning active chapter directly below search input
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
    if (loadingBottom || !hasMoreBottom || search) return;
    setLoadingBottom(true);
    const targetFromChapter = maxChapterNum + 1;

    try {
      const res = await ChapterRepository.getChapters(
        bookId,
        1,
        PAGE_SIZE,
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
        setHasMoreBottom(newChapters.length >= PAGE_SIZE);
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
    if (loadingTop || !hasMoreTop || minChapterNum <= 1 || search) return;
    setLoadingTop(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;
    const targetToChapter = minChapterNum - 1;
    const targetFromChapter = Math.max(1, minChapterNum - PAGE_SIZE);

    try {
      const res = await ChapterRepository.getChapters(
        bookId,
        1,
        PAGE_SIZE,
        'chapterNumber',
        'ASC',
        'all',
        search,
        targetFromChapter,
        targetToChapter
      );

      const newChapters = res.chapters || [];

      if (newChapters.length > 0) {
        setChapters((prev) => {
          const existingIds = new Set(prev.map((c) => c.chapterId));
          const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
          return [...uniqueNew, ...prev];
        });

        const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
        setMinChapterNum(newMin);
        setHasMoreTop(newMin > 1);

        // Adjust scroll position after prepending
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
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
    if (!scrollContainerRef.current || loading) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;

    // Scroll Down -> Load More Bottom
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      fetchNextBottomPage();
    }

    // Scroll Up -> Load More Top
    if (scrollTop <= 50) {
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
    navigate(`/book/${bookId}/chapter/${chapterId}`);
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl h-[78vh] max-h-[85dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2.5 flex-shrink-0" />

        {/* Header & Search */}
        <div className="px-4 py-2 mb-1 border-b border-outline-variant/20 space-y-2.5 flex-shrink-0 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-on-surface tracking-tight">Danh Sách Chương</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={isDownloaded ? () => setShowDeleteConfirm(true) : handleDownloadBook}
                disabled={Boolean(downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting'))}
                title={isDownloaded ? "Xóa dữ liệu ngoại tuyến" : "Tải bộ truyện về đọc offline"}
                aria-label={isDownloaded ? "Xóa dữ liệu ngoại tuyến" : "Tải bộ truyện về đọc offline"}
                className={`p-1.5 rounded-full transition-colors ${
                  isDownloaded
                    ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                    : downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting')
                    ? "text-primary bg-primary/10"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                {downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting') ? (
                  <RefreshCw size={16} className="animate-spin text-primary" />
                ) : isDownloaded ? (
                  <Trash2 size={16} />
                ) : (
                  <Download size={16} />
                )}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Tìm số hoặc tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium"
            />
          </div>
        </div>

        {/* Chapters Scroll Area with 2-way Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-2"
        >
          {loading && chapters.length === 0 ? (
            <div className="py-20 text-center space-y-2 text-on-surface-variant">
              <RefreshCw size={20} className="animate-spin mx-auto text-primary" />
              <p className="text-xs font-medium">Đang tải danh sách chương...</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
              Không tìm thấy chương nào
            </div>
          ) : (
            <>
              {/* Top Loading Spinner Indicator when Scrolling Up */}
              {loadingTop && (
                <div className="py-2 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Đang tải chương trước...</span>
                </div>
              )}

              {/* Section 2: All Chapters Header */}
              <div className="text-[11px] font-mono font-black text-on-surface-variant/70 uppercase tracking-wider flex items-center justify-between px-1 pt-1 pb-0.5">
                <span>📚 Danh sách chương ({chapters.length})</span>
              </div>

              {chapters.map((c, idx) => {
                const isActive = Boolean(
                  (currentChapterId && c.chapterId === currentChapterId) ||
                  (currentChapterNumber !== undefined && c.chapterNumber === currentChapterNumber)
                );
                return (
                  <div
                    key={c.chapterId || `chap-${c.chapterNumber || idx}-${idx}`}
                    ref={isActive ? activeItemRef : null}
                  >
                    <ChapterItem
                      chapter={c}
                      isActive={isActive}
                      showStatus={true}
                      onClick={() => handleSelectChapter(c.chapterId)}
                    />
                  </div>
                );
              })}

              {/* Bottom Loading Spinner Indicator when Scrolling Down */}
              {loadingBottom && (
                <div className="py-3 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Đang tải chương tiếp theo...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[96000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container text-on-surface w-full max-w-xs sm:max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors"
              >
                Xóa khỏi máy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
