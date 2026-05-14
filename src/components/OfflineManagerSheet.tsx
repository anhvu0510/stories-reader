import React, { useState, useEffect } from 'react';
import { X, Wifi, Download, Trash2, CheckCircle2, RotateCw } from 'lucide-react';
import { api, Book } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { showToast } from './Toast';

export function OfflineManagerSheet({ onClose, isEmbedded = false }: { onClose?: () => void, isEmbedded?: boolean }) {
  const [isOffline, setIsOffline] = useState(api.isOfflineMode());
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
    localStorage.setItem('offlineMode', String(val));
    setIsOffline(val);
    window.dispatchEvent(new CustomEvent('offline-mode-changed', { detail: val }));
  };

  const handleDeleteParams = async (bookId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá bộ truyện này khỏi máy?')) {
      await offlineDb.deleteBook(bookId);
      showToast('Đã xoá truyện', 'success');
      fetchSavedBooks();
    }
  };

  const content = (
    <div className={`relative bg-surface text-on-surface w-full flex flex-col ${!isEmbedded ? 'flex-1 overflow-hidden border border-outline-variant/30 h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-[600px] z-10' : 'h-full max-w-full'}`}>
      
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-5 border-b border-outline-variant/10 flex flex-col gap-3 bg-surface-container-low">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold font-serif text-primary flex items-center gap-2">
            <Download size={18} /> Đọc ngoại tuyến
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            {!isEmbedded && onClose && (
             <button onClick={onClose} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        {/* Toggle Mode */}
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-surface border border-outline-variant/20">
          <div>
            <h3 className="font-bold text-sm sm:text-base">Chế độ ngoại tuyến</h3>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              Tạm ngừng truy cập API, chỉ hiển thị dữ liệu đã lưu
            </p>
          </div>
          <button 
            onClick={() => toggleOfflineMode(!isOffline)}
            className={`relative w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${isOffline ? 'bg-primary' : 'bg-surface-variant'}`}
            role="switch"
            aria-checked={isOffline}
          >
            <span className={`absolute left-1 top-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white transition-transform ${isOffline ? 'translate-x-6 sm:translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar w-full bg-surface">
        <div className="p-3 sm:p-5 flex flex-col gap-3 max-w-[600px] mx-auto w-full">
          <h3 className="font-bold text-sm text-on-surface-variant mb-2">DANH SÁCH ĐÃ LƯU</h3>
          
          {isLoading ? (
            <div className="py-20 flex justify-center text-on-surface-variant">
              <RotateCw className="animate-spin" size={20} />
            </div>
          ) : savedBooks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4 border border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-lowest">
              <p className="text-on-surface-variant text-sm max-w-[280px]">
                Chưa có truyện nào được tải xuống. Hãy vào danh sách chương và chọn "Tải xuống" để lưu trữ đọc offline.
              </p>
            </div>
          ) : (
            savedBooks.map(book => (
              <div key={book.bookId} className="flex flex-col gap-3 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20">
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
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors flex-shrink-0"
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
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      {content}
    </div>
  );
}
