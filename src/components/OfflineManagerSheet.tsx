import React, { useState, useEffect } from 'react';
import { X, Wifi, Download, Trash2, CheckCircle2, RotateCw } from 'lucide-react';
import { Book } from '../shared/types';
import { offlineDb } from '../lib/offlineDb';
import { useAppStore } from '../stores/useAppStore';
import { useToastStore } from '../stores/useToastStore';
import { BottomSheet } from './BottomSheet';
import { motion } from 'motion/react';
import { triggerHaptic } from '../hooks/useHaptic';

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
    <div className={`relative bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full flex flex-col transition-colors duration-200 ${!isEmbedded ? 'flex-1 overflow-hidden border-t sm:border border-white/20 dark:border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1.5px_1.5px_0_rgba(255,255,255,0.4)] max-h-[85dvh] rounded-t-[32px] max-w-md mx-auto z-10 transform-gpu overscroll-contain' : 'h-full max-w-full'}`}>
      
      {/* Header & Drag Handle */}
      <div className="flex-shrink-0 pt-2.5 px-4 pb-3 border-b border-white/10 flex flex-col gap-2 bg-transparent">
        {!isEmbedded && <div className="w-10 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-1 flex-shrink-0" />}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
            <Download size={18} /> Đọc ngoại tuyến
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            {!isEmbedded && onClose && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="w-9 h-9 bg-white/10 dark:bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
                title="Đóng"
                aria-label="Đóng"
              >
                <X size={16} />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Toggle Mode Offline Card */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Wifi size={14} className={isOffline ? 'text-emerald-400' : 'text-on-surface-variant/60'} />
              <span>Chế độ đọc ngoại tuyến</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/70">Chỉ tải dữ liệu đã lưu trong máy</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              triggerHaptic('selection');
              toggleOfflineMode(!isOffline);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
              isOffline ? 'bg-primary' : 'bg-white/20'
            }`}
            title={isOffline ? 'Tắt chế độ ngoại tuyến' : 'Bật chế độ ngoại tuyến'}
            aria-label="Chuyển đổi chế độ đọc ngoại tuyến"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                isOffline ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </motion.button>
        </div>

        {/* Saved Books List */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-on-surface flex items-center justify-between">
            <span>Truyện đã lưu ({savedBooks.length})</span>
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
              <RotateCw size={14} className="animate-spin text-primary" /> Đang tải dữ liệu...
            </div>
          ) : savedBooks.length === 0 ? (
            <div className="py-6 text-center text-xs text-on-surface-variant/60 border border-dashed border-white/10 rounded-2xl">
              Chưa có truyện nào được lưu ngoại tuyến
            </div>
          ) : (
            savedBooks.map((book) => (
              <div
                key={book.bookId}
                className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                  <h4 className="font-bold text-on-surface truncate">{book.bookName}</h4>
                  <p className="text-[10px] text-on-surface-variant/70">
                    Đã tải {book.totalTranslated} chương
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => {
                      triggerHaptic('warning');
                      handleDeleteParams(book.bookId);
                    }}
                    className="w-8 h-8 rounded-xl text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center justify-center cursor-pointer"
                    title="Xóa truyện khỏi máy"
                    aria-label="Xóa truyện khỏi máy"
                  >
                    <Trash2 size={16} />
                  </motion.button>
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
    <BottomSheet
      isOpen={true}
      onClose={onClose || (() => {})}
      ariaLabel="Quản lý Offline"
      showDragHandle={false}
    >
      {content}
    </BottomSheet>
  );
}
