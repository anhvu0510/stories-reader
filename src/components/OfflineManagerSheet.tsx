import React, { useState, useEffect } from 'react';
import { X, Wifi, Download, Trash2, CheckCircle2, RotateCw } from 'lucide-react';
import { Book } from '../shared/types';
import { offlineDb } from '../lib/offlineDb';
import { useAppStore } from '../stores/useAppStore';
import { useToastStore } from '../stores/useToastStore';

export function OfflineManagerSheet({ onClose, isEmbedded = false }: { onClose?: () => void, isEmbedded?: boolean }) {
  const isOffline = useAppStore((state) => state.isOfflineMode);
  const setOfflineMode = useAppStore((state) => state.setOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const [savedBooks, setSavedBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchSavedBooks();
  }, []);

  const fetchSavedBooks = async () => {
    try {
      const books = await offlineDb.getBooks();
      setSavedBooks(books);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOfflineMode = (val: boolean) => {
    setOfflineMode(val);
  };

  const handleDeleteParams = async (bookId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá bộ truyện này khỏi máy?')) {
      await offlineDb.deleteBook(bookId);
      showToast('Đã xoá truyện', 'success');
      fetchSavedBooks();
      window.dispatchEvent(new CustomEvent('app-refresh'));
    }
  };

  const content = (
    <div className={`relative bg-black/25 dark:bg-black/40 backdrop-blur-[4px] text-on-surface w-full flex flex-col transition-colors duration-200 ${!isEmbedded ? 'flex-1 overflow-hidden border-t sm:border border-blue-500/30 dark:border-blue-400/25 shadow-[0_16px_36px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.45),_inset_0_-1px_0.5px_0_rgba(0,0,0,0.4)] max-h-[85dvh] rounded-t-[28px] max-w-md mx-auto z-10 transform-gpu overscroll-contain' : 'h-full max-w-full'}`}>
      
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-5 border-b border-blue-500/20 dark:border-blue-400/20 flex flex-col gap-3 bg-black/10 dark:bg-black/20">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-amber-400 flex items-center gap-2">
            <Download size={18} /> Đọc ngoại tuyến
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            {!isEmbedded && onClose && (
             <button onClick={onClose} className="p-2 sm:p-2.5 bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/15 transition-all active:scale-95">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        {/* Toggle Mode */}
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]">
          <div>
            <h3 className="font-bold text-sm sm:text-base">Chế độ ngoại tuyến</h3>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              Tạm ngừng truy cập API, chỉ hiển thị dữ liệu đã lưu
            </p>
          </div>
          <button 
            onClick={() => toggleOfflineMode(!isOffline)}
            className={`relative w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors flex-shrink-0 focus:outline-none ${isOffline ? 'bg-gradient-to-b from-amber-400 to-amber-500' : 'bg-white/10'}`}
            role="switch"
            aria-checked={isOffline}
          >
            <span className={`absolute left-1 top-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white transition-transform ${isOffline ? 'translate-x-6 sm:translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar w-full">
        <div className="p-3 sm:p-5 flex flex-col gap-3 max-w-[600px] mx-auto w-full">
          <h3 className="font-bold text-xs text-on-surface-variant/80 uppercase tracking-wider mb-1">DANH SÁCH ĐÃ LƯU</h3>
          
          {isLoading ? (
            <div className="py-20 flex justify-center text-on-surface-variant">
              <RotateCw className="animate-spin text-amber-400" size={20} />
            </div>
          ) : savedBooks.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-4 border border-dashed border-blue-500/20 rounded-3xl bg-white/5 p-6">
              <p className="text-on-surface-variant text-xs max-w-[280px]">
                Chưa có truyện nào được tải xuống. Hãy vào danh sách chương và chọn "Tải xuống" để lưu trữ đọc offline.
              </p>
            </div>
          ) : (
            savedBooks.map(book => (
              <div key={book.bookId} className="flex flex-col gap-3 p-4 bg-white/5 dark:bg-white/5 rounded-2xl border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm sm:text-base text-on-surface truncate">
                      {book.bookName}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {book.totalTranslated}/{book.chapterCount} chương
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDeleteParams(book.bookId)}
                    className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors flex-shrink-0"
                    title="Xoá khỏi máy"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="flex flex-col w-full h-full bg-surface">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-x-hidden box-border">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      {content}
    </div>
  );
}
