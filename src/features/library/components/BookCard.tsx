import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../../../shared/types';
import { Sparkles, BookOpen, ExternalLink, Trash2, Clock, Download, AlertCircle, Heart } from 'lucide-react';
import { QuickBookSheet } from './QuickBookSheet';
import { TranslationSheet } from '../../../components/TranslationSheet';
import { useAppStore } from '../../../stores/useAppStore';
import { useToastStore } from '../../../stores/useToastStore';
import { useFavoriteStore } from '../../../stores/useFavoriteStore';
import { offlineDb } from '../../../lib/offlineDb';
import { downloadManager } from '../../../lib/DownloadManager';
import { BookRepository } from '../../../repositories/BookRepository';

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

export const BookCard = React.memo(function BookCard({ book, activeTab, onSelect, isSelected, isSelectionMode }: BookCardProps) {
  const navigate = useNavigate();
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [showTranslationSheet, setShowTranslationSheet] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isSwipedOpen, setIsSwipedOpen] = useState(false);
  const [isSwipedOpenLeft, setIsSwipedOpenLeft] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'ONLINE' | 'OFFLINE' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);

  const isFav = useFavoriteStore((state) => state.favoriteBookIds.includes(book.bookId)) || Boolean(book.isFavorite);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await BookRepository.toggleFavorite(book.bookId);
      showToast(
        res.isFavorite ? `Đã thêm "${book.bookName}" vào yêu thích` : `Đã bỏ "${book.bookName}" khỏi yêu thích`,
        'success'
      );
      window.dispatchEvent(new CustomEvent('favorites-updated'));
    } catch {
      showToast('Không thể cập nhật trạng thái yêu thích', 'error');
    }
  };

  const readCount: number = Number(book.lastReadChapter?.chapterNumber || 0);
  const unTranslatedCount = Math.max(0, book.chapterCount - book.totalTranslated);

  useEffect(() => {
    offlineDb.getBook(book.bookId).then((b) => setIsDownloaded(Boolean(b)));
  }, [book.bookId]);

  // Auto-close open swipe menu when page is scrolled or when user moves vertically
  useEffect(() => {
    if (!isSwipedOpen && !isSwipedOpenLeft) return;

    const handleAutoClose = () => {
      setIsSwipedOpen(false);
      setIsSwipedOpenLeft(false);
    };

    window.addEventListener('scroll', handleAutoClose, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleAutoClose, { capture: true });
    };
  }, [isSwipedOpen, isSwipedOpenLeft]);

  // Listen for global event to close all other open swipe menus when another card is touched
  useEffect(() => {
    const handleCloseSwipes = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.exceptBookId !== book.bookId) {
        setIsSwipedOpen(false);
        setIsSwipedOpenLeft(false);
      }
    };

    window.addEventListener('close-all-swipes', handleCloseSwipes);
    return () => {
      window.removeEventListener('close-all-swipes', handleCloseSwipes);
    };
  }, [book.bookId]);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isScrollingYRef = useRef<boolean>(false);
  const swipeInitialStateRef = useRef<'CLOSED' | 'OPEN_LEFT' | 'OPEN_RIGHT'>('CLOSED');
  const cardElementRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    window.dispatchEvent(new CustomEvent('close-all-swipes', { detail: { exceptBookId: book.bookId } }));
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = false;
    isScrollingYRef.current = false;
    setIsSwiping(true);

    if (isSwipedOpenLeft) {
      swipeInitialStateRef.current = 'OPEN_LEFT';
    } else if (isSwipedOpen) {
      swipeInitialStateRef.current = 'OPEN_RIGHT';
    } else {
      swipeInitialStateRef.current = 'CLOSED';
    }

    if (cardElementRef.current) {
      cardElementRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    if (isScrollingYRef.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - touchStartYRef.current;

    // Lock direction on initial drag movement
    if (!isDraggingRef.current && !isScrollingYRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
        isScrollingYRef.current = true;
        setIsSwiping(false);
        if (isSwipedOpen || isSwipedOpenLeft) {
          setIsSwipedOpen(false);
          setIsSwipedOpenLeft(false);
        }
        return;
      }
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
        isDraggingRef.current = true;
      }
    }

    if (isDraggingRef.current && cardElementRef.current) {
      const initialState = swipeInitialStateRef.current;

      if (initialState === 'OPEN_LEFT') {
        let newTranslateX = actionTrayLeftWidth + deltaX;
        if (newTranslateX < 0) {
          newTranslateX = 0;
        } else if (newTranslateX > actionTrayLeftWidth) {
          const overflow = newTranslateX - actionTrayLeftWidth;
          newTranslateX = actionTrayLeftWidth + overflow * 0.2;
        }
        cardElementRef.current.style.transform = `translateX(${newTranslateX}px)`;
      } else if (initialState === 'OPEN_RIGHT') {
        let newTranslateX = -actionTrayWidth + deltaX;
        if (newTranslateX > 0) {
          newTranslateX = 0;
        } else if (newTranslateX < -actionTrayWidth) {
          const overflow = newTranslateX + actionTrayWidth;
          newTranslateX = -actionTrayWidth + overflow * 0.2;
        }
        cardElementRef.current.style.transform = `translateX(${newTranslateX}px)`;
      } else {
        let newTranslateX = deltaX;
        if (!isOfflineMode) {
          if (newTranslateX > actionTrayLeftWidth) {
            const overflow = newTranslateX - actionTrayLeftWidth;
            newTranslateX = actionTrayLeftWidth + overflow * 0.2;
          } else if (newTranslateX < -actionTrayWidth) {
            const overflow = newTranslateX + actionTrayWidth;
            newTranslateX = -actionTrayWidth + overflow * 0.2;
          }
        } else {
          if (newTranslateX > 0) {
            newTranslateX = newTranslateX * 0.2;
          } else if (newTranslateX < -actionTrayWidth) {
            const overflow = newTranslateX + actionTrayWidth;
            newTranslateX = -actionTrayWidth + overflow * 0.2;
          }
        }
        cardElementRef.current.style.transform = `translateX(${newTranslateX}px)`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false);
    if (cardElementRef.current) {
      cardElementRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (isDraggingRef.current && touchStartXRef.current !== null) {
      const touchEndX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
      const deltaX = touchEndX - touchStartXRef.current;
      const initialState = swipeInitialStateRef.current;

      if (initialState === 'OPEN_LEFT') {
        if (deltaX < -20) {
          setIsSwipedOpenLeft(false);
          setIsSwipedOpen(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = 'translateX(0px)';
        } else {
          setIsSwipedOpenLeft(true);
          setIsSwipedOpen(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = `translateX(${actionTrayLeftWidth}px)`;
        }
      } else if (initialState === 'OPEN_RIGHT') {
        if (deltaX > 20) {
          setIsSwipedOpen(false);
          setIsSwipedOpenLeft(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = 'translateX(0px)';
        } else {
          setIsSwipedOpen(true);
          setIsSwipedOpenLeft(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = `translateX(-${actionTrayWidth}px)`;
        }
      } else {
        if (!isOfflineMode && deltaX > 45) {
          setIsSwipedOpenLeft(true);
          setIsSwipedOpen(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = `translateX(${actionTrayLeftWidth}px)`;
        } else if (deltaX < -45) {
          setIsSwipedOpen(true);
          setIsSwipedOpenLeft(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = `translateX(-${actionTrayWidth}px)`;
        } else {
          setIsSwipedOpenLeft(false);
          setIsSwipedOpen(false);
          if (cardElementRef.current) cardElementRef.current.style.transform = 'translateX(0px)';
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isDraggingRef.current = false;
    isScrollingYRef.current = false;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSwipedOpen || isSwipedOpenLeft) {
      setIsSwipedOpen(false);
      setIsSwipedOpenLeft(false);
      return;
    }

    if (isSelectionMode && onSelect) {
      onSelect(book.bookId);
      return;
    }

    if (activeTab === 'HISTORY' && book.lastReadChapter?.chapterId) {
      navigate(`/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`);
    } else if (activeTab === 'AI') {
      setShowTranslationSheet(true);
    } else {
      setShowQuickSheet(true);
    }
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    setIsSwipedOpenLeft(false);
    const url = book.lastReadChapter?.chapterId
      ? `#/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`
      : `#/book/${book.bookId}`;
    window.open(url, '_blank');
  };

  const handleDownloadBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    setIsSwipedOpenLeft(false);
    downloadManager.addBook(book.bookId, book.bookName);
    showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
  };

  const handleOpenDeleteOfflineModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    setIsSwipedOpenLeft(false);
    setDeleteConfirmType('OFFLINE');
  };

  const handleOpenDeleteOnlineModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    setIsSwipedOpenLeft(false);
    setDeleteConfirmType('ONLINE');
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
  const actionTrayLeftWidth = 60;
  const actionTrayWidth = isOfflineMode ? 120 : (isDownloaded ? 180 : 120);

  const progressPct = book.chapterCount > 0
    ? Math.min(100, Math.round((readCount / book.chapterCount) * 100))
    : 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl w-full select-none">
        {/* Background Native Mobile Swipe Left Action Tiles (Online Delete Button) */}
        {!isOfflineMode && (
          <div
            className={`absolute inset-y-0 left-0 z-0 flex items-center justify-start overflow-hidden rounded-l-2xl h-full transition-opacity duration-150 ${
              isSwipedOpenLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={handleOpenDeleteOnlineModal}
              className="w-[60px] h-full bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center font-mono text-[10px] font-black gap-0.5 active:scale-95 transition-all shadow-inner"
              title="Xóa bộ truyện khỏi hệ thống"
            >
              <Trash2 size={18} />
              <span className="leading-none mt-0.5">XÓA</span>
            </button>
          </div>
        )}

        {/* Background Native Mobile Swipe Right Action Tiles (Theme-Synced) */}
        <div
          className={`absolute inset-y-0 right-0 z-0 flex items-center justify-end overflow-hidden rounded-r-2xl h-full transition-opacity duration-150 ${
            isSwipedOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Download Action Tile (Online Only) */}
          {!isOfflineMode && (
            <button
              onClick={handleDownloadBook}
              className="w-[60px] h-full bg-primary hover:opacity-90 text-on-primary flex flex-col items-center justify-center font-mono text-[10px] font-black gap-0.5 active:scale-95 transition-all shadow-inner"
              title="Tải về bộ truyện"
            >
              <Download size={18} />
              <span className="leading-none mt-0.5">TẢI VỀ</span>
            </button>
          )}

          {/* Open in New Tab Action Tile */}
          <button
            onClick={handleOpenNewTab}
            className="w-[60px] h-full bg-surface-container-highest hover:bg-surface-container-high text-on-surface border-l border-outline-variant/30 flex flex-col items-center justify-center font-mono text-[10px] font-black gap-0.5 active:scale-95 transition-all shadow-inner"
            title="Mở trong tab mới"
          >
            <ExternalLink size={18} />
            <span className="leading-none mt-0.5">MỞ TAB</span>
          </button>

          {/* Delete Offline Action Tile */}
          {(isOfflineMode || isDownloaded) && (
            <button
              onClick={handleOpenDeleteOfflineModal}
              className="w-[60px] h-full bg-rose-600/90 hover:bg-rose-600 text-white flex flex-col items-center justify-center font-mono text-[10px] font-black gap-0.5 active:scale-95 transition-all shadow-inner"
              title="Xóa khỏi máy"
            >
              <Trash2 size={18} />
              <span className="leading-none mt-0.5">XÓA</span>
            </button>
          )}
        </div>

        {/* Foreground Sliding Main Card */}
        <div
          ref={cardElementRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCardClick}
          style={{
            transform: isSwipedOpenLeft
              ? `translateX(${actionTrayLeftWidth}px)`
              : (isSwipedOpen ? `translateX(-${actionTrayWidth}px)` : 'translateX(0px)'),
          }}
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
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" title="Đã tải offline" />
            )}
          </div>

          {/* Right: Rich Content Details (Compact Mobile First Layout) */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Row 1: Title + Favorite Heart + Date */}
            <div className="flex items-start justify-between gap-1.5 min-w-0">
              <h3 className="text-[13px] font-bold text-on-surface leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2 min-w-0 flex-1">
                {book.bookName}
              </h3>
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`p-0.5 rounded-full transition-all active:scale-90 cursor-pointer ${
                    isFav
                      ? 'text-rose-500 hover:text-rose-600'
                      : 'text-on-surface-variant/40 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                  title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Heart
                    size={13}
                    className={isFav ? 'fill-rose-500 text-rose-500' : ''}
                  />
                </button>
                <span className="text-[9px] font-mono text-on-surface-variant/60 whitespace-nowrap">
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
                        className="inline-flex items-center px-1.5 py-0.25 rounded-md text-[8.5px] font-bold bg-primary/15 text-primary truncate max-w-[65px] border border-primary/30"
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

