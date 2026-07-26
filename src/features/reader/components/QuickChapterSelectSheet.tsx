import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { Chapter } from '../../../shared/types';
import { X, Search, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { ChapterItem } from '../../chapter-list/components/ChapterItem';

interface QuickChapterSelectSheetProps {
  bookId: string;
  currentChapterId?: string;
  onClose: () => void;
}

const PAGE_SIZE = 30;

export function QuickChapterSelectSheet({ bookId, currentChapterId, onClose }: QuickChapterSelectSheetProps) {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch chapters with pagination & search
  const fetchChapters = useCallback(
    async (targetPage: number, searchQuery: string, isAppend: boolean = false) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await ChapterRepository.getChapters(
          bookId,
          targetPage,
          PAGE_SIZE,
          'chapterNumber',
          'ASC',
          'all',
          searchQuery
        );

        const newChapters = res.chapters || [];
        const totalPages = res.pagination?.totalPages || 1;

        if (isAppend) {
          setChapters((prev) => {
            const existingIds = new Set(prev.map((c) => c.chapterId));
            const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
            return [...prev, ...uniqueNew];
          });
        } else {
          setChapters(newChapters);
        }

        setPage(targetPage);
        setHasMore(targetPage < totalPages && newChapters.length > 0);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [bookId]
  );

  // Initial load
  useEffect(() => {
    fetchChapters(1, '', false);
  }, [fetchChapters]);

  // Debounced API Search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchChapters(1, val, false);
    }, 300);
  };

  // Scroll event for Infinite Scroll pagination
  const handleScroll = () => {
    if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      fetchChapters(page + 1, search, true);
    }
  };

  // Scroll active chapter into view once loaded
  useEffect(() => {
    if (!loading && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading]);

  const handleSelectChapter = (chapterId: string) => {
    onClose();
    navigate(`/book/${bookId}/chapter/${chapterId}`);
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl h-[78vh] max-h-[85dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2.5 flex-shrink-0" />

        {/* Header & Search */}
        <div className="px-4 py-2 border-b border-outline-variant/20 space-y-2.5 flex-shrink-0 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-on-surface tracking-tight">Danh Sách Chương</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Tìm số hoặc tên chương..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium"
            />
          </div>
        </div>

        {/* Chapters Scroll Area with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-2"
        >
          {loading && chapters.length === 0 ? (
            <div className="py-20 text-center space-y-2 text-on-surface-variant">
              <RefreshCw size={20} className="animate-spin mx-auto text-primary" />
              <p className="text-xs font-medium">Đang tải danh sách chương...</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
              Không tìm thấy chương nào
            </div>
          ) : (
            <>
              {chapters.map((c, idx) => {
                const isActive = c.chapterId === currentChapterId;
                return (
                  <ChapterItem
                    key={c.chapterId || `chap-${c.chapterNumber || idx}-${idx}`}
                    ref={isActive ? activeItemRef : null}
                    chapter={c}
                    isActive={isActive}
                    showStatus={true}
                    onClick={() => handleSelectChapter(c.chapterId)}
                  />
                );
              })}

              {/* Infinite Scroll Bottom Spinner Indicator */}
              {loadingMore && (
                <div className="py-3 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Đang tải thêm...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
