import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../../../shared/types';
import { Sparkles, BookOpen, ExternalLink, Trash2, Clock, Download, AlertCircle, Layers } from 'lucide-react';
import { QuickBookSheet } from './QuickBookSheet';
import { TranslationSheet } from '../../../components/TranslationSheet';
import { useAppStore } from '../../../stores/useAppStore';
import { useToastStore } from '../../../stores/useToastStore';
import { offlineDb } from '../../../lib/offlineDb';
import { downloadManager } from '../../../lib/DownloadManager';

interface BookCardProps {
  key?: React.Key;
  book: Book;
  activeTab?: 'ALL' | 'HISTORY' | 'AI';
  onSelect?: (bookId: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onRefresh?: () => void;
}

export function BookCard({ book, activeTab, onSelect, isSelected, isSelectionMode }: BookCardProps) {
  const navigate = useNavigate();
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [showTranslationSheet, setShowTranslationSheet] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isSwipedOpen, setIsSwipedOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);

  const readCount: number = Number(book.lastReadChapter?.chapterNumber || 0);
  const unTranslatedCount = Math.max(0, book.chapterCount - book.totalTranslated);

  useEffect(() => {
    offlineDb.getBook(book.bookId).then((b) => setIsDownloaded(Boolean(b)));
  }, [book.bookId]);

  // Auto-close open swipe menu when page is scrolled or when user moves vertically
  useEffect(() => {
    if (!isSwipedOpen) return;

    const handleAutoClose = () => {
      setIsSwipedOpen(false);
    };

    window.addEventListener('scroll', handleAutoClose, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleAutoClose, { capture: true });
    };
  }, [isSwipedOpen]);

  // Listen for global event to close all other open swipe menus when another card is touched
  useEffect(() => {
    const handleCloseSwipes = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.exceptBookId !== book.bookId) {
        setIsSwipedOpen(false);
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
  const cardElementRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    window.dispatchEvent(new CustomEvent('close-all-swipes', { detail: { exceptBookId: book.bookId } }));
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = false;
    isScrollingYRef.current = false;
    setIsSwiping(true);

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
        if (isSwipedOpen) {
          setIsSwipedOpen(false);
        }
        return;
      }
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
        isDraggingRef.current = true;
      }
    }

    if (isDraggingRef.current && cardElementRef.current) {
      const baseOffset = isSwipedOpen ? -actionTrayWidth : 0;
      let newTranslateX = baseOffset + deltaX;

      // Dampen over-drag
      if (newTranslateX > 0) {
        newTranslateX = newTranslateX * 0.2;
      } else if (newTranslateX < -actionTrayWidth) {
        const overflow = newTranslateX + actionTrayWidth;
        newTranslateX = -actionTrayWidth + overflow * 0.2;
      }

      cardElementRef.current.style.transform = `translateX(${newTranslateX}px)`;
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

      if (!isSwipedOpen && deltaX < -45) {
        setIsSwipedOpen(true);
      } else if (isSwipedOpen && deltaX > 25) {
        setIsSwipedOpen(false);
      } else {
        if (cardElementRef.current) {
          cardElementRef.current.style.transform = isSwipedOpen
            ? `translateX(-${actionTrayWidth}px)`
            : 'translateX(0px)';
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
    if (isSwipedOpen) {
      setIsSwipedOpen(false);
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
    const url = book.lastReadChapter?.chapterId
      ? `#/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`
      : `#/book/${book.bookId}`;
    window.open(url, '_blank');
  };

  const handleDownloadBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    downloadManager.addBook(book.bookId, book.bookName);
    showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
  };

  const handleDeleteOfflineBook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwipedOpen(false);
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${book.bookName}" khỏi máy?`)) {
      await offlineDb.deleteBook(book.bookId);
      setIsDownloaded(false);
      showToast(`Đã xóa "${book.bookName}" khỏi máy`, 'success');
      window.dispatchEvent(new CustomEvent('app-refresh'));
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
  const actionTrayWidth = isOfflineMode ? 120 : (isDownloaded ? 180 : 120);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl w-full select-none">
        {/* Background Native Mobile Swipe Action Tiles (Theme-Synced) */}
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
              onClick={handleDeleteOfflineBook}
              className="w-[60px] h-full bg-rose-600/90 hover:bg-rose-600 text-white flex flex-col items-center justify-center font-mono text-[10px] font-black gap-0.5 active:scale-95 transition-all shadow-inner"
              title="Xóa khỏi máy"
            >
              <Trash2 size={18} />
              <span className="leading-none mt-0.5">XÓA</span>
            </button>
          )}
        </div>

        {/* Foreground Sliding Main Card (Premium Cohesive Theme Design) */}
        <div
          ref={cardElementRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCardClick}
          style={{
            transform: isSwipedOpen ? `translateX(-${actionTrayWidth}px)` : 'translateX(0px)',
          }}
          className={`group relative z-10 bg-surface-container rounded-2xl border-l-4 border-l-primary border border-outline-variant/20 p-3.5 transition-transform duration-200 ease-out cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-sm hover:border-primary/40 overflow-hidden active:scale-[0.99] ${
            isSelected
              ? 'border-primary ring-2 ring-primary/40 bg-primary/10'
              : 'hover:bg-surface-container-high/80'
          }`}
        >
          {/* Left Side: Sleek Modern TỔNG Badge (Theme-Synced) */}
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center flex-shrink-0 font-mono shadow-xs">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-primary/70 leading-none flex items-center gap-0.5">
              <Layers size={9} /> TỔNG
            </span>
            <span className="text-xs sm:text-sm font-black leading-none text-primary mt-1">{book.chapterCount}</span>
          </div>

          {/* Middle Content Section */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title */}
            <h3 className="text-sm sm:text-base font-extrabold text-on-surface leading-snug tracking-tight group-hover:text-primary transition-colors break-words whitespace-normal">
              {book.bookName}
            </h3>

            {/* Recently Read Chapter Info Pill */}
            {book.lastReadChapter?.chapterId && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant min-w-0 overflow-hidden">
                {/* Pill CH Badge */}
                <span className="px-2 py-0.5 min-w-[32px] h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-extrabold text-[10px] whitespace-nowrap flex items-center justify-center shrink-0 shadow-xs">
                  Ch.{book.lastReadChapter.chapterNumber}
                </span>

                {/* Marquee or Truncated Chapter Title */}
                {book.lastReadChapter.title && (
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {book.lastReadChapter.title.length > 20 ? (
                      <div className="animate-marquee-text whitespace-nowrap">
                        <span className="text-[11px] font-medium text-on-surface-variant/90 pr-6">
                          {book.lastReadChapter.title}
                        </span>
                        <span className="text-[11px] font-medium text-on-surface-variant/90 pr-6">
                          {book.lastReadChapter.title}
                        </span>
                      </div>
                    ) : (
                      <span className="truncate block text-on-surface-variant/90 text-[11px] font-medium">
                        {book.lastReadChapter.title}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Row: Date + Icon Badges (Single Non-Wrapping Line) */}
            <div className="flex items-center gap-1.5 text-[10.5px] font-mono whitespace-nowrap flex-nowrap shrink-0 overflow-hidden pt-0.5">
              {/* Timestamp */}
              <div className="flex items-center gap-1 text-on-surface-variant/70 shrink-0">
                <Clock size={11} className="text-on-surface-variant/60" />
                <span>{formattedDate}</span>
              </div>

              {/* Read Count Icon Badge */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-extrabold shrink-0"
                title={`Đã đọc: ${readCount}/${book.chapterCount}`}
              >
                <BookOpen size={11} className="text-emerald-400" />
                <span>{readCount}</span>
              </span>

              {/* Translated Count Icon Badge (Theme-Synced) */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-primary/30 bg-primary/10 text-primary font-extrabold shrink-0"
                title={`Đã dịch: ${book.totalTranslated}/${book.chapterCount}`}
              >
                <Sparkles size={11} className="text-primary" />
                <span>{book.totalTranslated}</span>
              </span>

              {/* Pending Count Icon Badge (if pending > 0 or in AI Tab) */}
              {(activeTab === 'AI' || unTranslatedCount > 0) && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 font-extrabold shrink-0"
                  title={`Chưa dịch: ${book.totalPending || unTranslatedCount}`}
                >
                  <AlertCircle size={11} className="text-rose-400" />
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
    </>
  );
}
