import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../../../shared/types';
import { Sparkles, BookOpen, Trash2, Heart, MoreVertical, AlertCircle } from 'lucide-react';
import { QuickBookSheet } from './QuickBookSheet';
import { BookActionSheet } from './BookActionSheet';
import { TranslationSheet } from '../../../components/TranslationSheet';
import { useAppStore } from '../../../stores/useAppStore';
import { useToastStore } from '../../../stores/useToastStore';
import { useFavoriteStore } from '../../../stores/useFavoriteStore';
import { offlineDb } from '../../../lib/offlineDb';
import { downloadManager } from '../../../lib/DownloadManager';
import { BookRepository } from '../../../repositories/BookRepository';
import { openChapter } from '../../../shared/utils/openChapter';
import { triggerHaptic } from '../../../hooks/useHaptic';
import { useLongPress } from '../../../hooks/useLongPress';

interface BookCardProps {
  key?: React.Key;
  book: Book;
  activeTab?: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI';
  onSelect?: (bookId: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onRefresh?: () => void;
  onTagClick?: (tag: string) => void;
}

export const BookCard = React.memo(function BookCard({
  book,
  activeTab,
  onSelect,
  isSelected,
  isSelectionMode,
  onTagClick,
}: BookCardProps) {
  const navigate = useNavigate();
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showTranslationSheet, setShowTranslationSheet] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'ONLINE' | 'OFFLINE' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);

  const isFav =
    useFavoriteStore((state) => state.favoriteBookIds.includes(book.bookId)) ||
    Boolean(book.isFavorite);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('selection');
    try {
      const res = await BookRepository.toggleFavorite(book.bookId);
      triggerHaptic('success');
      showToast(
        res.isFavorite
          ? `Đã thêm "${book.bookName}" vào yêu thích`
          : `Đã bỏ "${book.bookName}" khỏi yêu thích`,
        'success'
      );
      window.dispatchEvent(new CustomEvent('favorites-updated'));
    } catch {
      triggerHaptic('warning');
      showToast('Không thể cập nhật trạng thái yêu thích', 'error');
    }
  };

  const readCount: number = Number(book.lastReadChapter?.chapterNumber || 0);
  const unTranslatedCount = Math.max(0, book.chapterCount - book.totalTranslated);

  useEffect(() => {
    offlineDb.getBook(book.bookId).then((b) => setIsDownloaded(Boolean(b)));
  }, [book.bookId]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');

    if (isSelectionMode && onSelect) {
      onSelect(book.bookId);
      return;
    }

    if (activeTab === 'HISTORY' && book.lastReadChapter?.chapterId) {
      openChapter(book.bookId, book.lastReadChapter.chapterId);
    } else if (activeTab === 'AI') {
      setShowTranslationSheet(true);
    } else {
      setShowQuickSheet(true);
    }
  };

  const handleReadContinue = () => {
    if (book.lastReadChapter?.chapterId) {
      openChapter(book.bookId, book.lastReadChapter.chapterId);
    } else {
      setShowQuickSheet(true);
    }
  };

  const handleOpenNewTab = () => {
    const url = book.lastReadChapter?.chapterId
      ? `#/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`
      : `#/book/${book.bookId}`;
    window.open(url, '_blank');
  };

  const handleDownloadBook = () => {
    downloadManager.addBook(book.bookId, book.bookName);
    showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmType) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmType === 'ONLINE') {
        await BookRepository.deleteBook(book.bookId);
        showToast(`Đã xóa bộ truyện "${book.bookName}" khỏi hệ thống`, 'success');
      } else {
        await offlineDb.deleteBook(book.bookId);
        setIsDownloaded(false);
        showToast(`Đã xóa "${book.bookName}" khỏi máy`, 'success');
      }
      setDeleteConfirmType(null);
      window.dispatchEvent(new CustomEvent('app-refresh'));
    } catch (err: any) {
      showToast(`Lỗi khi xóa bộ truyện: ${err?.message || 'Không thể xóa'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

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

  const formattedDate = formatDate(book.updatedAt || (book as any).lastedReadAt);

  const progressPct =
    book.chapterCount > 0
      ? Math.min(100, Math.round((readCount / book.chapterCount) * 100))
      : 0;

  // Use long-press hook for tactile contextual menu without interfering with scrolling
  const longPressHandlers = useLongPress({
    threshold: 400,
    moveTolerance: 10,
    onLongPress: () => {
      setShowActionSheet(true);
    },
    onClick: handleCardClick,
  });

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl w-full select-none">
        {/* Main Card */}
        <div
          {...longPressHandlers}
          className={`group relative z-10 rounded-2xl border p-2 sm:p-2.5 transition-all duration-200 ease-out cursor-pointer flex items-center gap-2.5 overflow-hidden active:scale-[0.99] ${
            isSelected
              ? 'bg-primary/20 hover:bg-primary/25 backdrop-blur-md border-2 border-primary shadow-[0_4px_20px_rgba(245,158,11,0.35),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] text-primary'
              : 'bg-surface-container/35 hover:bg-surface-container/60 backdrop-blur-md border-2 border-outline-variant/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),_0_8px_24px_rgba(0,0,0,0.35)] hover:border-primary/80 hover:shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_0_12px_32px_rgba(245,158,11,0.2)] text-on-surface'
          }`}
        >
          {/* Left: Compact Square Book Icon Badge (3D Glass Mold) */}
          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-primary/30 via-primary/20 to-primary/10 border-2 border-primary/70 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),_0_4px_14px_rgba(245,158,11,0.2)] flex flex-col items-center justify-center p-0.5 shrink-0 overflow-hidden group-hover:border-primary group-hover:scale-105 transition-all">
            <BookOpen size={16} className="text-primary shrink-0 drop-shadow-xs" />
            <span className="text-[7.5px] font-mono font-black text-primary leading-tight whitespace-nowrap px-0.5 text-center mt-0.5">
              {book.chapterCount > 9999 ? `${(book.chapterCount / 1000).toFixed(1)}k` : book.chapterCount} ch
            </span>
            {isDownloaded && (
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                title="Đã tải offline"
              />
            )}
          </div>

          {/* Right: Rich Content Details (Compact Mobile First Layout) */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Row 1: Title + Action Buttons (Favorite + 3-Dot More) + Date */}
            <div className="flex items-start justify-between gap-1.5 min-w-0">
              <h3 className="text-[13px] font-bold text-on-surface leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2 min-w-0 flex-1">
                {book.bookName}
              </h3>
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                {/* Favorite Button */}
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`p-0.5 rounded-full transition-all active:scale-90 cursor-pointer ${
                    isFav
                      ? 'text-rose-500 hover:text-rose-600'
                      : 'text-on-surface-variant/40 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                  title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                  aria-label={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Heart
                    size={13}
                    className={isFav ? 'fill-rose-500 text-rose-500' : ''}
                  />
                </button>

                {/* 3-Dot Quick Action Menu Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setShowActionSheet(true);
                  }}
                  className="p-0.5 rounded-full text-on-surface-variant/40 hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
                  title="Tùy chọn thao tác"
                  aria-label={`Tùy chọn cho truyện ${book.bookName}`}
                >
                  <MoreVertical size={13} />
                </button>

                <span className="text-[9px] font-mono text-on-surface-variant/60 whitespace-nowrap ml-0.5">
                  {formattedDate}
                </span>
              </div>
            </div>

            {/* Row 2: Reading Chapter Title & Micro Progress Bar */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-on-surface-variant min-w-0">
                {book.lastReadChapter?.chapterId ? (
                  <>
                    <span className="px-1.5 py-0.25 rounded-md bg-gradient-to-b from-emerald-400/30 via-emerald-500/20 to-emerald-600/10 border border-emerald-400/70 text-emerald-300 font-mono font-black text-[9px] shrink-0 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5),_0_2px_8px_rgba(52,211,153,0.3)]">
                      Ch.{book.lastReadChapter.chapterNumber}
                    </span>
                    <span className="truncate text-on-surface-variant/90 text-[10px] font-medium min-w-0 flex-1">
                      {book.lastReadChapter.title || `Chương ${book.lastReadChapter.chapterNumber}`}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-on-surface-variant/50 italic">
                    Chưa đọc
                  </span>
                )}
              </div>
              {/* Micro Progress Bar */}
              {readCount > 0 && (
                <div className="w-full bg-black/40 border border-white/10 h-1 rounded-full overflow-hidden p-[1px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]">
                  <div
                    className="bg-gradient-to-r from-primary via-primary-fixed to-primary-fixed-dim h-full rounded-full transition-all duration-300 shadow-[0_0_8px_var(--primary)]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* Row 3: Tags Chips & Micro Stats Badges (Combined Single Row) */}
            <div className="flex items-center justify-between gap-1 min-w-0 overflow-hidden pt-0.5">
              {/* Left: Tags */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden shrink">
                {book.tags && book.tags.length > 0 ? (
                  <>
                    {book.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          if (onTagClick) {
                            e.stopPropagation();
                            triggerHaptic('light');
                            onTagClick(tag);
                          }
                        }}
                        className="inline-flex items-center px-1.5 py-0.25 rounded-md text-[8.5px] font-bold bg-primary/15 text-primary truncate max-w-[65px] border border-primary/30 cursor-pointer hover:bg-primary/25"
                      >
                        #{tag}
                      </span>
                    ))}
                    {book.tags.length > 2 && (
                      <span className="text-[8.5px] px-1 py-0.25 rounded-md bg-white/10 border border-white/15 text-on-surface-variant font-mono font-bold shrink-0">
                        +{book.tags.length - 2}
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              {/* Right: Inline Micro Stats */}
              <div className="flex items-center gap-1 text-[9px] font-mono whitespace-nowrap shrink-0 ml-auto">
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-primary/15 text-primary font-bold border border-primary/30"
                  title={`Đã đọc: ${readCount}/${book.chapterCount} (${progressPct}%)`}
                >
                  <BookOpen size={9} />
                  <span>{readCount}/{book.chapterCount}</span>
                </span>

                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-primary/15 text-primary font-bold border border-primary/30"
                  title={`Đã dịch: ${book.totalTranslated}/${book.chapterCount}`}
                >
                  <Sparkles size={9} />
                  <span>{book.totalTranslated}</span>
                </span>

                {(activeTab === 'AI' || unTranslatedCount > 0) && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-rose-500/15 text-rose-300 font-bold"
                    title={`Chưa dịch: ${book.totalPending || unTranslatedCount}`}
                  >
                    <AlertCircle size={9} />
                    <span>{book.totalPending || unTranslatedCount}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Quick Action Bottom Sheet */}
      <BookActionSheet
        book={book}
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isDownloaded={isDownloaded}
        isOfflineMode={isOfflineMode}
        isFavorite={isFav}
        readCount={readCount}
        unTranslatedCount={unTranslatedCount}
        onReadContinue={handleReadContinue}
        onOpenQuickSheet={() => setShowQuickSheet(true)}
        onOpenTranslationSheet={() => setShowTranslationSheet(true)}
        onDownloadBook={handleDownloadBook}
        onOpenDeleteOffline={() => setDeleteConfirmType('OFFLINE')}
        onOpenDeleteOnline={() => setDeleteConfirmType('ONLINE')}
        onToggleFavorite={handleToggleFavorite}
        onOpenNewTab={handleOpenNewTab}
      />

      {showQuickSheet && (
        <QuickBookSheet book={book} onClose={() => setShowQuickSheet(false)} />
      )}

      {showTranslationSheet && (
        <TranslationSheet
          currentBookId={book.bookId}
          currentBookName={book.bookName}
          initialTab="batch_chapter"
          disableCurrent={true}
          onClose={() => setShowTranslationSheet(false)}
        />
      )}

      {/* Confirmation Modal for Online/Offline Delete */}
      {deleteConfirmType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isDeleting && setDeleteConfirmType(null)}
        >
          <div
            className="w-full max-w-sm bg-black/40 backdrop-blur-[6px] border border-blue-500/30 dark:border-blue-400/25 rounded-3xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.45)] space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">
                  {deleteConfirmType === 'ONLINE' ? 'Xóa truyện khỏi hệ thống?' : 'Xóa truyện khỏi máy?'}
                </h3>
                <p className="text-xs font-mono text-on-surface-variant/70">Xác nhận thao tác xóa</p>
              </div>
            </div>

            {/* Target Details */}
            <div className="p-3 rounded-2xl bg-white/5 border border-outline-variant/30 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] space-y-1">
              <p className="text-xs font-bold text-primary line-clamp-1">{book.bookName}</p>
              <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                {deleteConfirmType === 'ONLINE'
                  ? 'Tất cả các chương, bản dịch AI và dữ liệu liên quan sẽ bị xóa vĩnh viễn khỏi server và không thể khôi phục.'
                  : 'Dữ liệu chương đã tải xuống trên thiết bị này sẽ bị xóa khỏi máy.'}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmType(null)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] text-on-surface hover:bg-white/15 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 hover:brightness-110 active:scale-95 text-white text-xs font-bold border border-rose-400/60 shadow-[0_4px_16px_rgba(225,29,72,0.5),_inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <span>Đang xóa...</span>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>{deleteConfirmType === 'ONLINE' ? 'Xóa vĩnh viễn' : 'Xóa khỏi máy'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
