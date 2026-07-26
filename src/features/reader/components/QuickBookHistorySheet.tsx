import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookRepository } from '../../../repositories/BookRepository';
import { Book } from '../../../shared/types';
import { X, Clock, Play, BookOpen, RefreshCw } from 'lucide-react';

interface QuickBookHistorySheetProps {
  currentBookId?: string;
  onClose: () => void;
}

export function QuickBookHistorySheet({ currentBookId, onClose }: QuickBookHistorySheetProps) {
  const navigate = useNavigate();
  const [historyBooks, setHistoryBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await BookRepository.getBooks();
      const allBooks = res.books || [];
      // Filter books with lastReadChapter or history
      const readBooks = allBooks.filter((b) => b.lastReadChapter || b.totalTranslated > 0);
      setHistoryBooks(readBooks);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSwapBook = (book: Book) => {
    onClose();
    if (book.lastReadChapter?.chapterId) {
      navigate(`/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`);
    } else {
      navigate(`/`);
    }
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl h-[70vh] max-h-[85dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2.5 flex-shrink-0" />

        {/* Header */}
        <div className="px-4 py-2.5 border-b border-outline-variant/20 flex items-center justify-between flex-shrink-0 bg-surface-container-low">
          <h3 className="text-sm font-extrabold text-on-surface tracking-tight flex items-center gap-1.5">
            <Clock size={16} className="text-primary" /> Lịch Sử Đọc Gần Đây ({historyBooks.length})
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Book List Area */}
        <div className="p-3 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-2.5">
          {loading ? (
            <div className="py-20 text-center space-y-2 text-on-surface-variant">
              <RefreshCw size={20} className="animate-spin mx-auto text-primary" />
              <p className="text-xs font-medium">Đang tải lịch sử đọc...</p>
            </div>
          ) : historyBooks.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
              Chưa có lịch sử đọc truyện nào
            </div>
          ) : (
            historyBooks.map((b) => {
              const isCurrent = b.bookId === currentBookId;
              const percent = b.chapterCount > 0 ? Math.round((b.totalTranslated / b.chapterCount) * 100) : 0;

              return (
                <div
                  key={b.bookId}
                  onClick={() => handleSwapBook(b)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] ${
                    isCurrent
                      ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                      : 'bg-surface border-outline-variant/20 hover:border-primary/40 text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold truncate tracking-tight">{b.bookName}</h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[9px] font-mono font-extrabold flex-shrink-0">
                          ĐANG ĐỌC
                        </span>
                      )}
                    </div>

                    {b.lastReadChapter ? (
                      <p className="text-[11px] text-on-surface-variant/80 truncate">
                        Đang đọc: Chương {b.lastReadChapter.chapterNumber} - {b.lastReadChapter.title}
                      </p>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant/60 truncate">{b.author || 'Tác giả mờ'}</p>
                    )}

                    <div className="text-[10px] font-mono text-on-surface-variant/60">
                      Tiến độ: {percent}% ({b.totalTranslated}/{b.chapterCount} chương)
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwapBook(b);
                    }}
                    className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                      isCurrent
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-on-surface hover:bg-primary hover:text-on-primary'
                    }`}
                    title="Đổi sang truyện này"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
