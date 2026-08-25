import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookRepository } from '../../repositories/BookRepository';
import { Book } from '../../shared/types';
import { useToastStore } from '../../stores/useToastStore';
import { useModalStore } from '../../stores/useModalStore';
import { useAppStore } from '../../stores/useAppStore';
import { BookCard } from './components/BookCard';
import { LibraryHeader } from './components/LibraryHeader';
import { TagFilterSheet } from './components/TagFilterSheet';
import { BottomDock } from '../../components/BottomDock';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { OfflineManagerSheet } from '../../components/OfflineManagerSheet';
import { BookOpen, Clock, Sparkles, Library, X, RotateCcw } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

import { useLibraryStore } from '../../stores/useLibraryStore';

export function LibraryScreen() {
  useDocumentTitle();
  const { savedPage, savedTab, savedSearch, savedTags, savedScrollY, setLibraryState } = useLibraryStore();

  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(savedPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(savedSearch);
  const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'AI'>(savedTab);
  const [selectedTags, setSelectedTags] = useState<string[]>(savedTags || []);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoredRef = useRef(false);

  // Sync state to useLibraryStore whenever page, tab, search, or selectedTags changes
  useEffect(() => {
    setLibraryState(page, tab, search, selectedTags);
  }, [page, tab, search, selectedTags, setLibraryState]);

  // Track and save scroll position on main container scroll
  const handleMainScroll = () => {
    if (mainScrollRef.current) {
      setLibraryState(page, tab, search, selectedTags, mainScrollRef.current.scrollTop);
    }
  };

  // Fetch paginated books directly from backend API with tab and tags filter
  const fetchBooks = useCallback(
    async (targetPage: number, querySearch?: string, activeTab?: string, filterTags?: string[]) => {
      setLoading(true);
      const q = querySearch !== undefined ? querySearch : search;
      const t = activeTab !== undefined ? activeTab : tab;
      const tg = filterTags !== undefined ? filterTags : selectedTags;
      try {
        const res = await BookRepository.getBooks(targetPage, 20, q, t, 'updatedAt', 'DESC', tg);
        const fetchedBooks = res.books || [];
        const { currentPage, totalPages: pagesCount, total: totalCount } = res.pagination || {};

        setBooks(fetchedBooks);
        setPage(currentPage || targetPage);
        setTotalPages(pagesCount || 1);
        setTotal(totalCount || fetchedBooks.length);
      } catch {
        showToast('Không thể tải danh sách truyện', 'error');
      } finally {
        setLoading(false);
      }
    },
    [search, tab, selectedTags, showToast]
  );

  useEffect(() => {
    fetchBooks(page, search, tab, selectedTags);

    const handleRefresh = () => {
      fetchBooks(page, search, tab, selectedTags);
    };

    window.addEventListener('app-refresh', handleRefresh);
    window.addEventListener('offline-mode-changed', handleRefresh);

    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
      window.removeEventListener('offline-mode-changed', handleRefresh);
    };
  }, [isOfflineMode]);

  // Restore scroll position after initial loading finishes
  useEffect(() => {
    if (!loading && books.length > 0 && !isRestoredRef.current) {
      isRestoredRef.current = true;
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      if (savedScrollY > 0 && mainScrollRef.current) {
        requestAnimationFrame(() => {
          if (mainScrollRef.current) {
            mainScrollRef.current.scrollTop = savedScrollY;
          }
        });
      } else if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    }
  }, [loading, books, savedScrollY]);

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setLibraryState(newPage, tab, search, selectedTags, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(newPage, search, tab, selectedTags);
  };

  // Optimized Debounced search handler (650ms delay + immediate clear)
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    setLibraryState(1, tab, val, selectedTags, 0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim() === '') {
      fetchBooks(1, '', tab, selectedTags);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchBooks(1, val, tab, selectedTags);
    }, 650);
  };

  // Immediate search submit handler (e.g. Enter key or Search icon click)
  const handleSearchSubmit = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchBooks(1, search, tab, selectedTags);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'AI') => {
    setTab(newTab);
    setPage(1);
    setLibraryState(1, newTab, search, selectedTags, 0);
    fetchBooks(1, search, newTab, selectedTags);
  };

  // Tag filter apply handler
  const handleTagFilterApply = (newTags: string[]) => {
    setSelectedTags(newTags);
    setPage(1);
    setLibraryState(1, tab, search, newTags, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(1, search, tab, newTags);
  };

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-200">
      {/* Pinned Sticky Header & Filters Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-outline-variant/20 shrink-0">
        <LibraryHeader
          searchQuery={search}
          onSearchChange={handleSearchChange}
          onSubmitSearch={handleSearchSubmit}
          onOpenSettings={() => openSettings('reader')}
          onOpenTagFilter={() => setIsTagFilterOpen(true)}
          activeTagsCount={selectedTags.length}
        />

        {/* Active Tag Filter Pills Row */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border-b border-primary/20 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => handleTagFilterApply([])}
              className="text-[10.5px] font-bold text-error hover:underline shrink-0 flex items-center gap-1 mr-0.5 px-1.5 py-0.5 rounded-md hover:bg-error/10 active:scale-95 transition-all"
              title="Xóa tất cả tags đang lọc"
            >
              <RotateCcw size={11} />
              <span>Xóa lọc</span>
            </button>
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-on-primary shrink-0 shadow-xs"
              >
                <span>#{tag}</span>
                <button
                  onClick={() => {
                    const updated = selectedTags.filter((t) => t !== tag);
                    handleTagFilterApply(updated);
                  }}
                  className="hover:opacity-80 active:scale-90"
                  title={`Bỏ tag ${tag}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-3.5 py-2.5 gap-2 border-t border-outline-variant/10">
          <h2 className="text-[11px] font-mono font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 min-w-0 truncate">
            {tab === 'HISTORY' ? (
              <Clock size={13} className="text-amber-400 shrink-0" />
            ) : tab === 'AI' ? (
              <Sparkles size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <Library size={13} className="text-primary shrink-0" />
            )}
            <span className="truncate">
              {tab === 'HISTORY'
                ? 'LỊCH SỬ ĐỌC TRUYỆN'
                : tab === 'AI'
                ? 'TRUYỆN CHỜ DỊCH AI'
                : 'DANH SÁCH TRUYỆN'}
            </span>
          </h2>

          {/* Action Icon Group: All, History, Pending AI, Refresh */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => handleTabChange('ALL')}
              className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                tab === 'ALL'
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
              }`}
              title="Tất cả truyện"
            >
              <BookOpen size={14} />
            </button>

            <button
              onClick={() => handleTabChange(tab === 'HISTORY' ? 'ALL' : 'HISTORY')}
              className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                tab === 'HISTORY'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold shadow-xs'
                  : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
              }`}
              title="Lịch sử đọc truyện"
            >
              <Clock size={14} />
            </button>

            {!isOfflineMode && (
              <button
                onClick={() => handleTabChange(tab === 'AI' ? 'ALL' : 'AI')}
                className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                  tab === 'AI'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-xs'
                    : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                }`}
                title="Truyện chờ dịch AI"
              >
                <Sparkles size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Independently Scrollable Book List */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 overflow-y-auto hide-scrollbar px-3.5 pt-3 pb-28 min-h-0"
      >
        {loading ? (
          <LoadingOverlay message="Đang kết nối thư viện..." />
        ) : books.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-xs font-medium text-on-surface-variant/60">
              {selectedTags.length > 0
                ? 'Không tìm thấy truyện nào phù hợp với bộ lọc tags'
                : tab === 'HISTORY'
                ? 'Chưa có lịch sử đọc truyện nào'
                : tab === 'AI'
                ? 'Không có truyện nào đang chờ dịch AI'
                : 'Không tìm thấy truyện nào trong thư viện'}
            </p>
            {selectedTags.length > 0 && (
              <button
                onClick={() => handleTagFilterApply([])}
                className="text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc tags
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {books.map((book) => (
              <BookCard
                key={book.bookId}
                book={book}
                activeTab={tab}
              />
            ))}
          </div>
        )}
      </main>

      {/* Global Settings & Modals */}
      <GlobalSettingsSheet />
      {isOfflineManagerOpen && <OfflineManagerSheet onClose={closeOfflineManager} />}

      {/* Tag Filter Bottom Sheet */}
      <TagFilterSheet
        isOpen={isTagFilterOpen}
        selectedTags={selectedTags}
        onApply={handleTagFilterApply}
        onClose={() => setIsTagFilterOpen(false)}
      />

      {/* Floating Paging Capsule Bottom Dock connected to Server-Side Tab API Pagination */}
      <BottomDock
        page={page}
        totalPages={totalPages}
        total={total}
        loading={loading}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
