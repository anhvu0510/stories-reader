import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookRepository } from '../../../repositories/BookRepository';
import { Book } from '../../../shared/types';
import { X, Clock, BookOpen, Sparkles, Layers, Search, RefreshCw } from 'lucide-react';
import { useGlobalLoading } from '../../../hooks/useGlobalLoading';

interface QuickBookHistorySheetProps {
  currentBookId?: string;
  onClose: () => void;
}

export function QuickBookHistorySheet({ currentBookId, onClose }: QuickBookHistorySheetProps) {
  const navigate = useNavigate();
  const [historyBooks, setHistoryBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoading(loading && historyBooks.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHistoryBooks = useCallback(async (querySearch: string = '') => {
    setLoading(true);
    try {
      const res = await BookRepository.getBooks(1, 9999, querySearch, 'HISTORY', 'lastedReadAt', 'DESC');
      const allBooks = res.books || [];
      setHistoryBooks(allBooks);
    } catch {
      try {
        const res = await BookRepository.getBooks(1, 9999, querySearch, 'ALL', 'lastedReadAt', 'DESC');
        const allBooks = res.books || [];
        setHistoryBooks(allBooks.filter((b) => b.lastReadChapter || b.totalTranslated > 0));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoryBooks('');
  }, [fetchHistoryBooks]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim() === '') {
      fetchHistoryBooks('');
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchHistoryBooks(val);
    }, 650);
  };

  const handleSearchSubmit = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchHistoryBooks(searchQuery);
  };

  const handleSwapBook = (book: Book) => {
    onClose();
    if (book.lastReadChapter?.chapterId) {
      navigate(`/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`);
    } else {
      navigate(`/book/${book.bookId}`);
    }
  };

  const currentBook = historyBooks.find((b) => b.bookId === currentBookId);
  const otherBooks = historyBooks.filter((b) => b.bookId !== currentBookId);
  const displayBooks = searchQuery.trim() ? historyBooks : otherBooks;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  const renderBookCard = (book: Book, isPinned: boolean) => {
    const rawDate = book.lastedReadAt || book.updatedAt || book.createdAt;
    const formattedDate = formatDate(rawDate);
    const readCount = book.lastReadChapter?.chapterNumber || (book.totalTranslated > 0 ? 1 : 0);

    return (
      <div
        key={book.bookId}
        onClick={() => handleSwapBook(book)}
        className={`group relative z-10 rounded-xl p-2.5 transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 shadow-xs hover:shadow-md overflow-hidden active:scale-[0.99] ${
          isPinned
            ? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 border-l-4 border-l-primary text-primary shadow-xs'
            : 'bg-white/[0.04] dark:bg-white/[0.04] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] border border-white/10 dark:border-white/10 border-l-4 border-l-primary shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.15)] hover:border-primary/50 text-on-surface'
        }`}
      >
        {/* Left Side: Ultra-Compact TỔNG Badge */}
        <div
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0 font-mono shadow-2xs ${
            isPinned
              ? 'bg-primary/30 border border-primary/70 text-primary font-extrabold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
              : 'bg-primary/10 border border-primary/30 text-primary/90 font-bold'
          }`}
        >
          <span className={`text-[7px] font-extrabold uppercase tracking-wider leading-none flex items-center gap-0.5 ${isPinned ? 'text-primary/80' : 'text-primary/80'}`}>
            <Layers size={8} /> TỔNG
          </span>
          <span className={`text-xs font-black leading-none mt-0.5 ${isPinned ? 'text-primary' : 'text-primary'}`}>{book.chapterCount}</span>
        </div>

        {/* Middle Content Section */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h4 className={`text-xs font-extrabold leading-tight tracking-tight transition-colors truncate ${isPinned ? 'text-primary font-black drop-shadow-xs' : 'text-on-surface group-hover:text-primary'}`}>
            {book.bookName}
          </h4>

          {/* Recently Read Chapter Info Pill */}
          {book.lastReadChapter?.chapterId && (
            <div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
              <span className={`px-1.5 py-0.5 min-w-[28px] h-5 rounded-md font-mono font-extrabold text-[9.5px] whitespace-nowrap flex items-center justify-center shrink-0 shadow-2xs ${
                isPinned
                  ? 'bg-primary/25 border border-primary/50 text-primary'
                  : 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
              }`}>
                Ch.{book.lastReadChapter.chapterNumber}
              </span>
              {book.lastReadChapter.title && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <span className={`truncate block text-[10.5px] font-medium ${isPinned ? 'text-primary/90' : 'text-on-surface-variant/90'}`}>
                    {book.lastReadChapter.title}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Row: Date + Icon Badges */}
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono whitespace-nowrap flex-nowrap shrink-0 overflow-hidden pt-0.5">
            <div className={`flex items-center gap-1 shrink-0 ${isPinned ? 'text-primary/80 font-medium' : 'text-on-surface-variant/70'}`}>
              <Clock size={10} className={isPinned ? 'text-primary/70' : 'text-on-surface-variant/60'} />
              <span>{formattedDate}</span>
            </div>

            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 ${
              isPinned
                ? 'border border-emerald-400/40 bg-emerald-400/20 text-emerald-300'
                : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}>
              <BookOpen size={10} className={isPinned ? 'text-emerald-300' : 'text-emerald-400'} />
              <span>{readCount}</span>
            </span>

            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 ${
              isPinned
                ? 'border border-primary/40 bg-primary/20 text-primary'
                : 'border border-primary/30 bg-primary/10 text-primary'
            }`}>
              <Sparkles size={10} className={isPinned ? 'text-primary' : 'text-primary'} />
              <span>{book.totalTranslated}</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[99000] bg-black/35 backdrop-blur-[2px] flex justify-center items-end p-0 overflow-x-hidden overscroll-none box-border">
      <div className="absolute inset-0" onClick={onClose} onTouchMove={(e) => e.preventDefault()} />

      <div className="relative z-10 bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t sm:border border-white/20 dark:border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1px_1.5px_0_rgba(255,255,255,0.4)] h-[78vh] max-h-[90dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Header & Search (100% unified top header) */}
        <div className="pt-2.5 px-4 pb-2.5 border-b border-white/10 space-y-2 flex-shrink-0 bg-transparent">
          {/* Drag Handle */}
          <div className="w-10 h-1 rounded-full bg-white/30 mx-auto flex-shrink-0" />

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-on-surface tracking-tight flex items-center gap-1.5 uppercase">
              <Clock size={15} className="text-primary" /> LỊCH SỬ ĐỌC TRUYỆN ({historyBooks.length})
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer"
              title="Bấm để tìm kiếm"
            >
              <Search size={13} />
            </button>
            <input
              type="text"
              placeholder="Tìm kiếm truyện trong lịch sử (nhấn Enter)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/10 dark:bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-all"
                title="Xóa từ khóa"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Book List Area */}
        <div className="p-3 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium" />
          ) : historyBooks.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
              {searchQuery
                ? `Không tìm thấy truyện phù hợp với "${searchQuery}"`
                : 'Chưa có lịch sử đọc truyện nào'}
            </div>
          ) : (
            <>
              {/* Permanently Pinned Current Book Section (Only when not searching) */}
              {currentBook && !searchQuery.trim() && (
                <div className="space-y-1.5 pb-1">
                  {renderBookCard(currentBook, true)}
                  {otherBooks.length > 0 && (
                    <div className="h-px w-full bg-outline-variant/30 my-2.5" />
                  )}
                </div>
              )}

              {/* History List / Search Results Section */}
              {displayBooks.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono font-extrabold text-on-surface-variant/70 uppercase tracking-widest px-1">
                    <span>{searchQuery.trim() ? 'KẾT QUẢ TÌM KIẾM' : 'DANH SÁCH LỊCH SỬ'}</span>
                    <span>{displayBooks.length} truyện</span>
                  </div>
                  <div className="space-y-3">
                    {displayBooks.map((b) => renderBookCard(b, false))}
                  </div>
                </div>
              ) : (
                searchQuery.trim() && (
                  <div className="py-10 text-center text-xs text-on-surface-variant/60 font-medium">
                    Không tìm thấy truyện phù hợp với "{searchQuery}"
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
