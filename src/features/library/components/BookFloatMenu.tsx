import React from 'react';
import { Book } from '../../../shared/types';
import { BottomSheet } from '../../../components/BottomSheet';
import {
  BookOpen,
  Sparkles,
  Download,
  ExternalLink,
  Heart,
  ListTree,
  X,
  RefreshCw,
  Languages,
  Users,
  Tags,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { triggerHaptic } from '../../../hooks/useHaptic';
import { useToastStore } from '../../../stores/useToastStore';
import { AIRepository } from '../../../repositories/AIRepository';

export interface BookFloatMenuProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  isDownloaded: boolean;
  isOfflineMode: boolean;
  isFavorite: boolean;
  readCount?: number;
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

export const BookFloatMenu = React.memo(function BookFloatMenu({
  book,
  isOpen,
  onClose,
  isDownloaded,
  isOfflineMode,
  isFavorite,
  onReadContinue,
  onOpenQuickSheet,
  onOpenTranslationSheet,
  onDownloadBook,
  onOpenDeleteOnline,
  onToggleFavorite,
  onOpenNewTab,
}: BookFloatMenuProps) {
  const showToast = useToastStore((state) => state.showToast);

  const handleAction = (action: () => void) => {
    triggerHaptic('selection');
    onClose();
    action();
  };

  // 1. Dịch tiêu đề
  const handleTranslateTitles = () => {
    triggerHaptic('selection');
    onClose();
    showToast('Đã gửi yêu cầu dịch tiêu đề', 'success');
    AIRepository.translateChineseTitles({ bookId: book.bookId }).catch((err) => {
      console.warn('translateChineseTitles error:', err);
    });
  };

  // 2. Dịch tên
  const handleDetectProperNouns = () => {
    triggerHaptic('selection');
    onClose();
    showToast('Đã gửi yêu cầu dịch tên', 'success');
    AIRepository.detectProperNouns({ bookId: book.bookId }).catch((err) => {
      console.warn('detectProperNouns error:', err);
    });
  };

  // 3. Dịch POV
  const handleDetectTagsAndPov = () => {
    triggerHaptic('selection');
    onClose();
    showToast('Đã gửi yêu cầu dịch POV', 'success');
    AIRepository.detectTagsAndPov({ bookId: book.bookId }).catch((err) => {
      console.warn('detectTagsAndPov error:', err);
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`Thao tác cho truyện ${book.bookName}`}
      maxHeight="max-h-[85dvh]"
      className="p-0"
    >
      <div className="flex flex-col text-on-surface">
        {/* Header mini thanh thoát */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant/30 flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/50 text-primary flex items-center justify-center p-0.5 shrink-0 shadow-xs">
              <BookOpen size={14} />
            </div>
            <h3 className="text-sm font-bold text-on-surface truncate leading-tight">
              {book.bookName}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút xóa truyện cạnh nút tắt */}
            {!isOfflineMode && (
              <button
                type="button"
                onClick={() => handleAction(onOpenDeleteOnline)}
                className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/25 shadow-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all flex items-center justify-center cursor-pointer active:scale-90"
                title="Xóa truyện khỏi hệ thống"
                aria-label="Xóa truyện khỏi hệ thống"
              >
                <Trash2 size={13} />
              </button>
            )}

            {/* Nút tắt / đóng */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="w-7 h-7 rounded-full bg-white/10 border border-white/20 shadow-xs text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all flex items-center justify-center cursor-pointer active:scale-90"
              title="Đóng"
              aria-label="Đóng"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Nội dung menu nhỏ gọn: 1 Hero Action + Lưới 4 nút / hàng */}
        <div className="p-3 sm:p-4">
          {/* Hero Bar: Đọc Tiếp */}
          <button
            type="button"
            onClick={() => handleAction(onReadContinue)}
            className="w-full mb-3 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-gradient-to-r from-primary/25 via-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 active:scale-[0.98] border border-primary/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_2px_10px_rgba(245,158,11,0.15)] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-primary/30 border border-primary/60 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <BookOpen size={15} />
              </div>
              <div className="flex items-baseline gap-1.5 truncate text-left">
                <span className="text-xs font-bold text-primary">Đọc tiếp</span>
                <span className="text-[11px] font-mono text-on-surface-variant truncate">
                  {book.lastReadChapter?.chapterNumber
                    ? `Chương ${book.lastReadChapter.chapterNumber}`
                    : 'Chương 1'}
                </span>
              </div>
            </div>
            <ChevronRight
              size={15}
              className="text-primary/70 group-hover:translate-x-0.5 transition-transform shrink-0"
            />
          </button>

          {/* Lưới chuẩn 4 nút / hàng (Không lồng hộp thô cứng, chỉ gồm Icon squircle + Title) */}
          <div className="grid grid-cols-4 gap-y-3 gap-x-1.5 sm:gap-x-2">
            {/* 1. Mục lục */}
            <button
              type="button"
              onClick={() => handleAction(onOpenQuickSheet)}
              className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center text-on-surface group-hover:scale-105 transition-transform mb-1 shadow-xs">
                <ListTree size={19} />
              </div>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-on-surface transition-colors truncate max-w-full">
                Mục lục
              </span>
            </button>

            {/* 2. Mở tab mới */}
            <button
              type="button"
              onClick={() => handleAction(onOpenNewTab)}
              className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-sky-500/15 hover:bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
                <ExternalLink size={19} />
              </div>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-sky-400 transition-colors truncate max-w-full">
                Tab mới
              </span>
            </button>

            {/* 3. Tải về / Đồng bộ lại */}
            <button
              type="button"
              onClick={() => handleAction(onDownloadBook)}
              className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
            >
              <div
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center group-hover:scale-105 transition-transform mb-1 shadow-xs ${
                  isDownloaded
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-sky-500/15 hover:bg-sky-500/20 border-sky-500/30 text-sky-400'
                }`}
              >
                {isDownloaded ? <RefreshCw size={18} /> : <Download size={19} />}
              </div>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-emerald-400 transition-colors truncate max-w-full">
                {isDownloaded ? 'Đồng bộ lại' : 'Tải về'}
              </span>
            </button>

            {/* 4. Yêu thích */}
            <button
              type="button"
              onClick={(e) => {
                triggerHaptic('selection');
                onToggleFavorite(e);
              }}
              className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform mb-1 border shadow-xs ${
                  isFavorite
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                    : 'bg-white/10 hover:bg-white/15 border-white/15 text-on-surface-variant'
                }`}
              >
                <Heart size={19} className={isFavorite ? 'fill-rose-500' : ''} />
              </div>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-rose-400 transition-colors truncate max-w-full">
                {isFavorite ? 'Đã thích' : 'Yêu thích'}
              </span>
            </button>

            {/* 5. Dịch AI */}
            <button
              type="button"
              onClick={() => handleAction(onOpenTranslationSheet)}
              className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
                <Sparkles size={19} />
              </div>
              <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-indigo-400 transition-colors truncate max-w-full">
                Dịch AI
              </span>
            </button>

            {/* 6. Dịch tiêu đề */}
            {!isOfflineMode && (
              <button
                type="button"
                onClick={handleTranslateTitles}
                className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
                  <Languages size={19} />
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-amber-400 transition-colors truncate max-w-full">
                  Dịch tiêu đề
                </span>
              </button>
            )}

            {/* 7. Dịch tên */}
            {!isOfflineMode && (
              <button
                type="button"
                onClick={handleDetectProperNouns}
                className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-teal-500/15 hover:bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
                  <Users size={19} />
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-teal-400 transition-colors truncate max-w-full">
                  Dịch tên
                </span>
              </button>
            )}

            {/* 8. Dịch POV */}
            {!isOfflineMode && (
              <button
                type="button"
                onClick={handleDetectTagsAndPov}
                className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-violet-500/15 hover:bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
                  <Tags size={19} />
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant group-hover:text-violet-400 transition-colors truncate max-w-full">
                  Dịch POV
                </span>
              </button>
            )}
          </div>


        </div>
      </div>
    </BottomSheet>
  );
});

export { BookFloatMenu as BookActionSheet };
export type { BookFloatMenuProps as BookActionSheetProps };
