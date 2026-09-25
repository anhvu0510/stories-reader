import React from 'react';
import { Book } from '../../../shared/types';
import { BottomSheet } from '../../../components/BottomSheet';
import {
  BookOpen,
  Sparkles,
  Download,
  ExternalLink,
  Trash2,
  Heart,
  ChevronRight,
  ListTree,
  X,
  HardDriveDownload,
} from 'lucide-react';
import { triggerHaptic } from '../../../hooks/useHaptic';

export interface BookActionSheetProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  isDownloaded: boolean;
  isOfflineMode: boolean;
  isFavorite: boolean;
  readCount: number;
  unTranslatedCount: number;
  onReadContinue: () => void;
  onOpenQuickSheet: () => void;
  onOpenTranslationSheet: () => void;
  onDownloadBook: () => void;
  onOpenDeleteOffline: () => void;
  onOpenDeleteOnline: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onOpenNewTab: () => void;
}

export const BookActionSheet = React.memo(function BookActionSheet({
  book,
  isOpen,
  onClose,
  isDownloaded,
  isOfflineMode,
  isFavorite,
  readCount,
  unTranslatedCount,
  onReadContinue,
  onOpenQuickSheet,
  onOpenTranslationSheet,
  onDownloadBook,
  onOpenDeleteOffline,
  onOpenDeleteOnline,
  onToggleFavorite,
  onOpenNewTab,
}: BookActionSheetProps) {
  const progressPct =
    book.chapterCount > 0
      ? Math.min(100, Math.round((readCount / book.chapterCount) * 100))
      : 0;

  const handleAction = (action: () => void) => {
    triggerHaptic('selection');
    onClose();
    action();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`Thao tác cho truyện ${book.bookName}`}
      maxHeight="max-h-[90dvh]"
      className="p-0"
    >
      <div className="flex flex-col max-h-[85dvh] text-on-surface">
        {/* Header: Book Details Card */}
        <div className="p-4 sm:p-5 border-b border-white/10 dark:border-white/10 bg-white/[0.02]">
          <div className="flex items-start gap-3.5">
            {/* Book Icon Badge */}
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-primary/30 via-primary/20 to-primary/10 border-2 border-primary/70 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),_0_4px_14px_rgba(245,158,11,0.25)] flex flex-col items-center justify-center p-1 shrink-0 overflow-hidden">
              <BookOpen size={18} className="text-primary shrink-0 drop-shadow-xs" />
              <span className="text-[8px] font-mono font-black text-primary leading-tight whitespace-nowrap px-0.5 text-center mt-0.5">
                {book.chapterCount > 9999
                  ? `${(book.chapterCount / 1000).toFixed(1)}k`
                  : book.chapterCount}{' '}
                ch
              </span>
              {isDownloaded && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  title="Đã tải offline"
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-on-surface leading-snug tracking-tight line-clamp-1">
                  {book.bookName}
                </h3>
              </div>

              {/* Progress & Chapter stats */}
              <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant font-mono">
                <span className="text-emerald-400 font-bold">
                  {readCount > 0 ? `Chương ${readCount}` : 'Chưa đọc'}
                </span>
                <span className="text-on-surface-variant/40">•</span>
                <span>{progressPct}% tiến độ</span>
                {isDownloaded && (
                  <>
                    <span className="text-on-surface-variant/40">•</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.25 rounded-md border border-emerald-500/20">
                      Offline
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="p-2 -mr-1 -mt-1 rounded-full text-on-surface-variant/70 hover:text-on-surface hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Đóng bảng thao tác"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Items List */}
        <div className="p-3 sm:p-4 space-y-2 overflow-y-auto overscroll-contain hide-scrollbar pb-6">
          {/* 1. Continue Reading */}
          <button
            type="button"
            onClick={() => handleAction(onReadContinue)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 active:scale-[0.98] border border-primary/30 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
                <BookOpen size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                  {book.lastReadChapter?.chapterNumber
                    ? `Đọc tiếp Chương ${book.lastReadChapter.chapterNumber}`
                    : 'Bắt đầu đọc (Chương 1)'}
                </p>
                <p className="text-[11px] text-on-surface-variant/80 line-clamp-1">
                  {book.lastReadChapter?.title || 'Tiếp tục hành trình đọc'}
                </p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-primary/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
            />
          </button>

          {/* 2. Chapter List & Quick Browse */}
          <button
            type="button"
            onClick={() => handleAction(onOpenQuickSheet)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-on-surface shrink-0">
                <ListTree size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                  Mục lục & Danh sách chương
                </p>
                <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                  Tra cứu, tìm kiếm nhanh {book.chapterCount} chương
                </p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
            />
          </button>

          {/* 3. AI Translation */}
          <button
            type="button"
            onClick={() => handleAction(onOpenTranslationSheet)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-bold text-on-surface group-hover:text-indigo-400 transition-colors line-clamp-1">
                    Dịch thuật AI hàng loạt
                  </p>
                  {unTranslatedCount > 0 && (
                    <span className="px-1.5 py-0.25 text-[9px] font-mono font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      +{unTranslatedCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                  {unTranslatedCount > 0
                    ? `Còn ${unTranslatedCount} chương cần dịch tự động`
                    : `Toàn bộ ${book.chapterCount} chương đã hoàn tất`}
                </p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-on-surface-variant/40 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
            />
          </button>

          {/* 4. Favorite Toggle */}
          <button
            type="button"
            onClick={(e) => {
              triggerHaptic('selection');
              onToggleFavorite(e);
            }}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  isFavorite
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                    : 'bg-white/10 border-white/15 text-on-surface-variant'
                }`}
              >
                <Heart
                  size={20}
                  className={isFavorite ? 'fill-rose-500 text-rose-500' : ''}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-on-surface group-hover:text-rose-400 transition-colors line-clamp-1">
                  {isFavorite ? 'Bỏ khỏi mục Yêu thích' : 'Thêm vào mục Yêu thích'}
                </p>
                <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                  {isFavorite
                    ? 'Truyện đang được ghim trong tab Yêu thích'
                    : 'Ghim truyện để tiện theo dõi nhanh'}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ml-2 ${
                isFavorite
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-white/5 border-white/10 text-on-surface-variant/60'
              }`}
            >
              {isFavorite ? 'Đang thích' : 'Chưa lưu'}
            </span>
          </button>

          {/* 5. Download / Offline Action */}
          {!isOfflineMode && !isDownloaded && (
            <button
              type="button"
              onClick={() => handleAction(onDownloadBook)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Download size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-on-surface group-hover:text-sky-400 transition-colors line-clamp-1">
                    Tải về đọc ngoại tuyến
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                    Lưu trữ vào máy để đọc khi không có Internet
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-on-surface-variant/40 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
              />
            </button>
          )}

          {/* If already downloaded, show delete offline */}
          {isDownloaded && (
            <button
              type="button"
              onClick={() => handleAction(onOpenDeleteOffline)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/5 hover:bg-amber-500/10 active:scale-[0.98] border border-amber-500/20 transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <HardDriveDownload size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-amber-300 group-hover:text-amber-200 transition-colors line-clamp-1">
                    Xóa dữ liệu tải offline
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                    Giải phóng bộ nhớ IndexedDB trên máy này
                  </p>
                </div>
              </div>
              <Trash2
                size={16}
                className="text-amber-400/70 group-hover:text-amber-300 shrink-0 ml-2"
              />
            </button>
          )}

          {/* 6. Open in New Tab */}
          <button
            type="button"
            onClick={() => handleAction(onOpenNewTab)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-on-surface-variant shrink-0">
                <ExternalLink size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                  Mở trong tab mới
                </p>
                <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                  Đọc trong cửa sổ trình duyệt độc lập
                </p>
              </div>
            </div>
            <ExternalLink
              size={16}
              className="text-on-surface-variant/40 group-hover:text-primary shrink-0 ml-2"
            />
          </button>

          {/* 7. Delete Book from System (Online Only) */}
          {!isOfflineMode && (
            <button
              type="button"
              onClick={() => handleAction(onOpenDeleteOnline)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 active:scale-[0.98] border border-rose-500/20 transition-all cursor-pointer group text-left mt-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-rose-400 group-hover:text-rose-300 transition-colors line-clamp-1">
                    Xóa truyện khỏi hệ thống
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 line-clamp-1">
                    Xóa vĩnh viễn khỏi server (Không thể hoàn tác)
                  </p>
                </div>
              </div>
              <Trash2
                size={16}
                className="text-rose-400/70 group-hover:text-rose-300 shrink-0 ml-2"
              />
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
});
