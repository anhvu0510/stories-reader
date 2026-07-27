import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { Book, Chapter } from '../../../shared/types';
import { X, Play, Download, Search, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { ChapterItem } from '../../chapter-list/components/ChapterItem';
import { downloadManager } from '../../../lib/DownloadManager';
import { useToastStore } from '../../../stores/useToastStore';
import { useAppStore } from '../../../stores/useAppStore';
import { offlineDb } from '../../../lib/offlineDb';

interface QuickBookSheetProps {
  book: Book;
  onClose: () => void;
}

const PAGE_SIZE = 30;

export function QuickBookSheet({ book, onClose }: QuickBookSheetProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const isOfflineMode = useAppStore((state) => state.isOfflineMode);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isDownloaded, setIsDownloaded] = useState(false);

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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const percent = book.chapterCount > 0 ? Math.round((book.totalTranslated / book.chapterCount) * 100) : 0;

  // Fetch chapters with pagination & search
  const fetchChapters = useCallback(
    async (targetPage: number, searchQuery: string, isAppend: boolean = false) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await ChapterRepository.getChapters(
          book.bookId,
          targetPage,
          PAGE_SIZE,
          'chapterNumber',
          'ASC',
          'all',
          searchQuery
        );

        const newChapters = res.chapters || [];
        const totalPages = res.pagination?.totalPages || 1;

        if (isAppend) {
          setChapters((prev) => {
            const existingIds = new Set(prev.map((c) => c.chapterId));
            const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
            return [...prev, ...uniqueNew];
          });
        } else {
          setChapters(newChapters);
        }

        setPage(targetPage);
        setHasMore(targetPage < totalPages && newChapters.length > 0);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [book.bookId]
  );

  // Initial load
  useEffect(() => {
    fetchChapters(1, '', false);
  }, [fetchChapters]);

  // Debounced API Search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchChapters(1, val, false);
    }, 300);
  };

  // Scroll event for Infinite Scroll pagination
  const handleScroll = () => {
    if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      fetchChapters(page + 1, search, true);
    }
  };

  // Scroll active chapter into view once loaded
  useEffect(() => {
    if (!loading && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading]);

  const handleContinueReading = () => {
    onClose();
    if (book.lastReadChapter?.chapterId) {
      navigate(`/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`);
    } else if (chapters.length > 0) {
      navigate(`/book/${book.bookId}/chapter/${chapters[0].chapterId}`);
    }
  };

  const handleSelectChapter = (chapterId: string) => {
    onClose();
    navigate(`/book/${book.bookId}/chapter/${chapterId}`);
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl h-[82vh] max-h-[90dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2.5 flex-shrink-0" />

        {/* Top Header & Compact Icon Action Bar */}
        <div className="px-4 py-3 border-b border-outline-variant/20 space-y-3 flex-shrink-0 bg-surface-container-low">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold text-on-surface tracking-tight leading-snug truncate">
                {book.bookName}
              </h2>
              {book.author && <p className="text-xs text-on-surface-variant/70 font-medium truncate">{book.author}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Summary Cards */}
          <div className={`grid gap-2 ${isOfflineMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="p-2.5 rounded-2xl bg-surface border border-outline-variant/20">
              <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider block">TIẾN ĐỘ DỊCH</span>
              <div className="text-sm font-black text-primary flex items-center gap-1 mt-0.5 font-mono">
                <span>{percent}%</span>
                <span className="text-[10px] font-normal text-on-surface-variant/70">({book.totalTranslated}/{book.chapterCount})</span>
              </div>
            </div>

            {!isOfflineMode && (
              <div className="p-2.5 rounded-2xl bg-surface border border-outline-variant/20">
                <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider block">CHỜ DỊCH AI</span>
                <div className="text-sm font-black text-on-surface mt-0.5 font-mono">
                  <span>{book.totalPending} chương</span>
                </div>
              </div>
            )}
          </div>

          {/* Compact Icon Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleContinueReading}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
            >
              <Play size={15} fill="currentColor" />
              <span>Đọc tiếp</span>
            </button>

            {isDownloaded ? (
              <button
                onClick={handleDeleteOfflineBook}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-all active:scale-[0.98]"
                title="Xóa truyện khỏi máy"
              >
                <Trash2 size={15} />
                <span>Xóa khỏi máy</span>
              </button>
            ) : !isOfflineMode ? (
              <button
                onClick={handleDownloadBook}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-surface border border-outline-variant/30 text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-all active:scale-[0.98]"
                title="Tải về ngoại tuyến"
              >
                <Download size={15} />
                <span>Tải về</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Search Bar for Inline Chapter List */}
        <div className="px-4 py-2 border-b border-outline-variant/20 flex-shrink-0 bg-surface-container-low">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Tìm nhanh số hoặc tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium"
            />
          </div>
        </div>

        {/* Inline Chapter List Container with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-1.5"
        >
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
              {/* Section 1: Recently Read Chapter (Shown only if history exists) */}
              {book.lastReadChapter?.chapterId && (
                <div className="mb-3 space-y-1.5">
                  <div className="text-[11px] font-mono font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1 px-1">
                    <span>📌 Chương đọc gần đây</span>
                  </div>
                  <ChapterItem
                    chapter={{
                      chapterId: book.lastReadChapter.chapterId,
                      chapterNumber: Number(book.lastReadChapter.chapterNumber || 1),
                      title: book.lastReadChapter.title || `Chương ${book.lastReadChapter.chapterNumber}`,
                      state: 'SUCCEEDED',
                      updatedAt: new Date().toISOString(),
                      bookId: book.bookId,
                    }}
                    isActive={true}
                    onClick={() => handleSelectChapter(book.lastReadChapter!.chapterId)}
                  />
                </div>
              )}

              {/* Section 2: All Chapters */}
              <div className="text-[11px] font-mono font-black text-on-surface-variant/70 uppercase tracking-wider flex items-center justify-between px-1 pt-1 pb-0.5">
                <span>📚 Tất cả chương</span>
              </div>

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

              {/* Infinite Scroll Bottom Spinner Indicator */}
              {loadingMore && (
                <div className="py-3 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Đang tải thêm chương tiếp theo...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
