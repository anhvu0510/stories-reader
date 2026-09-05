import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../repositories/ChapterRepository';
import { BookRepository } from '../../repositories/BookRepository';
import { Chapter, Book } from '../../shared/types';
import { useToastStore } from '../../stores/useToastStore';
import { ChapterItem } from './components/ChapterItem';
import { ChapterRangeSelector } from './components/ChapterRangeSelector';
import { BottomDock } from '../../components/BottomDock';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useReaderConfigStore } from '../../stores/useReaderConfigStore';
import { ArrowLeft, Search, RefreshCw, Download, Heart } from 'lucide-react';
import { downloadManager } from '../../lib/DownloadManager';

export function ChapterListScreen() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  useDocumentTitle(book?.bookName);

  const isFav =
    useFavoriteStore((state) => (bookId ? state.isFavorite(bookId) : false)) || Boolean(book?.isFavorite);

  const handleToggleFavorite = async () => {
    if (!bookId) return;
    try {
      const res = await BookRepository.toggleFavorite(bookId);
      showToast(
        res.isFavorite ? `Đã thêm "${book?.bookName || 'truyện'}" vào yêu thích` : `Đã bỏ "${book?.bookName || 'truyện'}" khỏi yêu thích`,
        'success'
      );
      if (book) {
        setBook({ ...book, isFavorite: res.isFavorite });
      }
      window.dispatchEvent(new CustomEvent('favorites-updated'));
    } catch {
      showToast('Không thể cập nhật trạng thái yêu thích', 'error');
    }
  };

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [activeRange, setActiveRange] = useState<string>('all');
  const [rangeBounds, setRangeBounds] = useState<{ start?: number; end?: number }>({});

  const showToast = useToastStore((state) => state.showToast);
  const chapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch chapters with pagination, sorting & state filter
  const fetchChapters = useCallback(
    async (
      targetPage: number,
      searchQuery: string,
      targetState: string,
      targetSort: 'ASC' | 'DESC',
      isAppend: boolean = false
    ) => {
      if (!bookId) return;
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        if (!book && !isAppend) {
          const bookData = await BookRepository.getBook(bookId);
          if (bookData) setBook(bookData);
        }

        const res = await ChapterRepository.getChapters(
          bookId,
          targetPage,
          chapterLimit,
          'chapterNumber',
          targetSort,
          targetState,
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
        showToast('Lỗi khi tải danh sách chương', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [bookId, book, chapterLimit, showToast]
  );

  // Initial load or sort/state filter change
  useEffect(() => {
    fetchChapters(1, search, filterState, sortOrder, false);
  }, [bookId, filterState, sortOrder, chapterLimit]);

  // Debounced Search API Call
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchChapters(1, val, filterState, sortOrder, false);
    }, 300);
  };

  // Window Scroll for Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.documentElement.scrollHeight - 300;

      if (scrollPosition >= scrollThreshold) {
        fetchChapters(page + 1, search, filterState, sortOrder, true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, page, search, filterState, sortOrder, fetchChapters]);

  const handleRangeSelect = (range: string, start?: number, end?: number) => {
    setActiveRange(range);
    setRangeBounds({ start, end });
  };

  // Filter chapters by range chunk
  const filteredChapters = chapters.filter((c) => {
    if (rangeBounds.start !== undefined && rangeBounds.end !== undefined) {
      return c.chapterNumber >= rangeBounds.start && c.chapterNumber <= rangeBounds.end;
    }
    return true;
  });

  return (
    <div className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-28 border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-3.5 py-3 space-y-2.5 w-full max-w-md mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0 active:scale-95"
              title="Về Thư viện"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-on-surface truncate">{book?.bookName || 'Đang tải...'}</h1>
              <p className="text-[10px] font-mono text-on-surface-variant/70 truncate">
                {book?.author || 'Vô danh'} • {book?.chapterCount || chapters.length} CHƯƠNG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {book && (
              <>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-full border transition-all active:scale-95 cursor-pointer ${
                    isFav
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-500 shadow-xs'
                      : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-rose-400'
                  }`}
                  title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Heart size={15} className={isFav ? 'fill-rose-500 text-rose-500' : ''} />
                </button>

                <button
                  onClick={() => {
                    downloadManager.addBook(book.bookId, book.bookName);
                    showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
                  }}
                  className="p-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
                  title="Tải về bộ truyện"
                >
                  <Download size={15} />
                </button>
              </>
            )}

            <button
              onClick={() => fetchChapters(1, search, filterState, sortOrder, false)}
              disabled={loading}
              className="p-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
              title="Làm mới"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
        </div>

        {/* Search & State Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Tìm số/tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium"
            />
          </div>

          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="px-2.5 py-1.5 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface font-mono font-bold"
          >
            <option value="all">Tất cả</option>
            <option value="SUCCEEDED">Đã dịch</option>
            <option value="PENDING">Chưa dịch</option>
            <option value="FAILED">Lỗi</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className="px-2.5 py-1.5 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs font-mono font-extrabold text-primary active:scale-95"
          >
            {sortOrder === 'ASC' ? '▲' : '▼'}
          </button>
        </div>

        {/* Chapter Range Chunk Filter Bar (1-100, 101-200) */}
        {book && (
          <ChapterRangeSelector
            totalChapters={book.chapterCount || chapters.length}
            activeRange={activeRange}
            onRangeSelect={handleRangeSelect}
          />
        )}
      </header>

      {/* Main Chapter List */}
      <main className="px-3.5 pt-3">
        {loading && chapters.length === 0 ? (
          <LoadingOverlay message="Đang tải danh sách chương..." />
        ) : filteredChapters.length === 0 ? (
          <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
            Không tìm thấy chương nào trong khoảng này
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Section 1: Recently Read Chapter (Shown only if history exists) */}
            {book?.lastReadChapter?.chapterId && (
              <div className="mb-2 space-y-1.5">
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
                  bookId={bookId || ''}
                />
              </div>
            )}

            {/* Section 2: All Chapters Header */}
            <div className="text-[11px] font-mono font-black text-on-surface-variant/70 uppercase tracking-wider flex items-center justify-between px-1 pt-1 pb-0.5">
              <span>📚 Tất cả chương</span>
            </div>

            {filteredChapters.map((chapter) => {
              const isCurrentReading = Boolean(
                chapter.chapterId === book?.lastReadChapter?.chapterId ||
                chapter.chapterNumber === Number(book?.lastReadChapter?.chapterNumber)
              );
              return (
                <ChapterItem
                  key={chapter.chapterId}
                  chapter={chapter}
                  bookId={bookId || ''}
                  isActive={isCurrentReading}
                />
              );
            })}

            {/* Infinite Scroll Bottom Spinner Indicator */}
            {loadingMore && (
              <div className="py-4 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
                <RefreshCw size={14} className="animate-spin text-primary" />
                <span>Đang tải thêm chương tiếp theo...</span>
              </div>
            )}
          </div>
        )}
      </main>

      <GlobalSettingsSheet currentBookId={bookId} />
      <BottomDock />
    </div>
  );
}
