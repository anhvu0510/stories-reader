import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookRepository } from '../../../repositories/BookRepository';
import { Book } from '../../../shared/types';
import { X, Clock, BookOpen, Sparkles, RefreshCw, Layers, Search } from 'lucide-react';

interface QuickBookHistorySheetProps {
  currentBookId?: string;
  onClose: () => void;
}

export function QuickBookHistorySheet({ currentBookId, onClose }: QuickBookHistorySheetProps) {
  const navigate = useNavigate();
  const [historyBooks, setHistoryBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHistoryBooks = useCallback(async (querySearch: string = '') => {
    setLoading(true);
    try {
      const res = await BookRepository.getBooks(1, 9999, querySearch, 'HISTORY');
      const allBooks = res.books || [];
      setHistoryBooks(allBooks);
    } catch {
      try {
        const res = await BookRepository.getBooks(1, 9999, querySearch);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '23-07-2026';
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
    const formattedDate = formatDate(book.updatedAt || (book as any).lastedReadAt);
    const readCount = book.lastReadChapter?.chapterNumber || (book.totalTranslated > 0 ? 1 : 0);

    return (
      <div
        key={book.bookId}
        onClick={() => handleSwapBook(book)}
        className={`group relative z-10 rounded-xl border-l-4 p-2.5 transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 shadow-xs hover:shadow-md overflow-hidden active:scale-[0.99] ${
          isPinned
            ? 'bg-amber-500/10 border border-amber-500/30 border-l-amber-400 ring-1 ring-amber-500/20 shadow-sm'
            : 'bg-surface-container-high border border-outline-variant/35 border-l-primary/80 hover:border-primary/60 hover:bg-surface-container-highest'
        }`}
      >
        {/* Left Side: Ultra-Compact TỔNG Badge */}
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center flex-shrink-0 font-mono shadow-2xs">
          <span className="text-[7px] font-extrabold uppercase tracking-wider text-primary/70 leading-none flex items-center gap-0.5">
            <Layers size={8} /> TỔNG
          </span>
          <span className="text-xs font-black leading-none text-primary mt-0.5">{book.chapterCount}</span>
        </div>

        {/* Middle Content Section */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h4 className="text-xs font-bold text-on-surface leading-tight tracking-tight group-hover:text-primary transition-colors truncate">
            {book.bookName}
          </h4>

          {/* Recently Read Chapter Info Pill */}
          {book.lastReadChapter?.chapterId && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant min-w-0 overflow-hidden">
              <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-extrabold text-[9px] flex items-center justify-center shrink-0 shadow-2xs">
                {book.lastReadChapter.chapterNumber}
              </span>
              {book.lastReadChapter.title && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <span className="truncate block text-on-surface-variant/90 text-[10.5px] font-medium">
                    {book.lastReadChapter.title}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Row: Date + Icon Badges */}
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono whitespace-nowrap flex-nowrap shrink-0 overflow-hidden pt-0.5">
            <div className="flex items-center gap-1 text-on-surface-variant/70 shrink-0">
              <Clock size={10} className="text-on-surface-variant/60" />
              <span>{formattedDate}</span>
            </div>

            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold shrink-0">
              <BookOpen size={10} className="text-emerald-400" />
              <span>{readCount}</span>
            </span>

            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md border border-primary/30 bg-primary/10 text-primary font-bold shrink-0">
              <Sparkles size={10} className="text-primary" />
              <span>{book.totalTranslated}</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container-low text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl h-[78vh] max-h-[90dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2 flex-shrink-0" />

        {/* Header */}
        <div className="px-4 py-2 border-b border-outline-variant/20 flex items-center justify-between flex-shrink-0 bg-surface-container-low">
          <h3 className="text-xs font-black text-on-surface tracking-tight flex items-center gap-1.5 uppercase">
            <Clock size={15} className="text-amber-400" /> LỊCH SỬ ĐỌC TRUYỆN ({historyBooks.length})
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="px-3.5 pt-2.5 pb-1 flex-shrink-0">
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
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/20 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium transition-all"
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
            <div className="py-20 text-center space-y-2 text-on-surface-variant">
              <RefreshCw size={20} className="animate-spin mx-auto text-primary" />
              <p className="text-xs font-medium">Đang tải lịch sử đọc...</p>
            </div>
          ) : historyBooks.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
              {searchQuery
                ? `Không tìm thấy truyện phù hợp với "${searchQuery}"`
                : 'Chưa có lịch sử đọc truyện nào'}
            </div>
          ) : (
            <>
              {/* Permanently Pinned Current Book Section */}
              {currentBook && !searchQuery && (
                <div className="space-y-1.5 pb-1">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest px-1">
                    <span>📌</span>
                  </div>
                  {renderBookCard(currentBook, true)}
                  {otherBooks.length > 0 && (
                    <div className="h-px w-full bg-outline-variant/30 my-2.5" />
                  )}
                </div>
              )}

              {/* History List Section */}
              {otherBooks.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono font-extrabold text-on-surface-variant/70 uppercase tracking-widest px-1">
                    <span>DANH SÁCH LỊCH SỬ</span>
                    <span>{otherBooks.length} truyện</span>
                  </div>
                  <div className="space-y-3">
                    {otherBooks.map((b) => renderBookCard(b, false))}
                  </div>
                </div>
              ) : (
                searchQuery && (
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
