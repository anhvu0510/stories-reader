import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../../../shared/types';
import { Sparkles, BookOpen, ExternalLink, Trash2, Clock, Download, AlertCircle } from 'lucide-react';
import { QuickBookSheet } from './QuickBookSheet';
import { TranslationSheet } from '../../../components/TranslationSheet';
import { useAppStore } from '../../../stores/useAppStore';
import { useToastStore } from '../../../stores/useToastStore';
import { offlineDb } from '../../../lib/offlineDb';
import { downloadManager } from '../../../lib/DownloadManager';
import { BookRepository } from '../../../repositories/BookRepository';

interface BookCardProps {
  key?: React.Key;
  book: Book;
  activeTab?: 'ALL' | 'HISTORY' | 'AI';
  onSelect?: (bookId: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onRefresh?: () => void;
  onTagClick?: (tag: string) => void;
}

export function BookCard({ book, activeTab, onSelect, isSelected, isSelectionMode }: BookCardProps) {
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
              isSwipedOpenLeft || isSwiping ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
            isSwipedOpen || isSwiping ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
          className={`group relative z-10 bg-surface-container rounded-2xl border border-outline-variant/25 p-3 transition-transform duration-200 ease-out cursor-pointer flex items-center gap-3 shadow-xs hover:shadow-sm hover:border-primary/40 overflow-hidden active:scale-[0.99] ${
            isSelected
              ? 'border-primary ring-2 ring-primary/40 bg-primary/10'
              : 'hover:bg-surface-container-high/80'
          }`}
        >
          {/* Left: Square Book Icon Badge */}
          <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-surface-container-highest border border-primary/25 flex flex-col items-center justify-center p-1 shrink-0 overflow-hidden shadow-xs group-hover:border-primary/40 group-hover:scale-105 transition-all">
            <BookOpen size={20} className="text-primary shrink-0" />
            <span className="text-[8.5px] font-mono font-black text-primary/90 mt-0.5 leading-none">
              {book.chapterCount} ch
            </span>
            {isDownloaded && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Đã tải offline" />
            )}
          </div>

          {/* Right: Rich Content Details */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Row 1: Title + Date */}
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h3 className="text-[13.5px] sm:text-sm font-bold text-on-surface leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-1 min-w-0">
                {book.bookName}
              </h3>
              <span className="text-[10px] font-mono text-on-surface-variant/60 shrink-0 whitespace-nowrap pt-0.5">
                {formattedDate}
              </span>
            </div>

            {/* Row 2: Reading Progress / Chapter Title */}
            {book.lastReadChapter?.chapterId ? (
              <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant min-w-0">
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[9.5px] shrink-0">
                  Ch.{book.lastReadChapter.chapterNumber}
                </span>
                <span className="truncate text-on-surface-variant/80 text-[10.5px]">
                  {book.lastReadChapter.title || `Chương ${book.lastReadChapter.chapterNumber}`}
                </span>
              </div>
            ) : (
              <div className="text-[10.5px] text-on-surface-variant/50 italic">
                Chưa đọc
              </div>
            )}

            {/* Row 3: Mini Progress Bar if reading */}
            {readCount > 0 && (
              <div className="w-full bg-surface-container-highest/80 h-1 rounded-full overflow-hidden my-0.5">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}

            {/* Row 4: Streamlined Tags (Informational badges only, 1 line, max 3 tags + '+N' counter) */}
            {book.tags && book.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-nowrap overflow-hidden pt-0.5">
                {book.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant shrink-0"
                  >
                    #{tag}
                  </span>
                ))}
                {book.tags.length > 3 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-container-highest/60 border border-outline-variant/20 text-on-surface-variant/60 font-mono font-bold shrink-0">
                    +{book.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Row 5: Stats Footer */}
            <div className="flex items-center gap-2 text-[10px] font-mono whitespace-nowrap flex-nowrap shrink-0 overflow-hidden pt-0.5 text-on-surface-variant/70">
              {/* Read Status */}
              <span
                className="inline-flex items-center gap-0.5 text-emerald-400 font-bold"
                title={`Đã đọc: ${readCount}/${book.chapterCount} (${progressPct}%)`}
              >
                <BookOpen size={10} />
                <span>{readCount}/{book.chapterCount}</span>
              </span>

              {/* Translated Count */}
              <span
                className="inline-flex items-center gap-0.5 text-primary font-bold"
                title={`Đã dịch: ${book.totalTranslated}/${book.chapterCount}`}
              >
                <Sparkles size={10} />
                <span>{book.totalTranslated}</span>
              </span>

              {/* Pending / Untranslated */}
              {(activeTab === 'AI' || unTranslatedCount > 0) && (
                <span
                  className="inline-flex items-center gap-0.5 text-rose-400 font-bold"
                  title={`Chưa dịch: ${book.totalPending || unTranslatedCount}`}
                >
                  <AlertCircle size={10} />
                  <span>{book.totalPending || unTranslatedCount}</span>
                </span>
              )}
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
            className="w-full max-w-sm bg-surface-container-high border border-outline-variant/30 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
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
            <div className="p-3 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/20 space-y-1">
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
                className="px-4 py-2 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/25 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
}
