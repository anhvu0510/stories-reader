import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookRepository } from '../../repositories/BookRepository';
import { Book } from '../../shared/types';
import { useToastStore } from '../../stores/useToastStore';
import { useModalStore } from '../../stores/useModalStore';
import { useAppStore } from '../../stores/useAppStore';
import { BookCard } from './components/BookCard';
import { LibraryHeader } from './components/LibraryHeader';
import { TagFilterSheet } from './components/TagFilterSheet';
import { SortSheet } from './components/SortSheet';
import { BottomDock } from '../../components/BottomDock';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { OfflineManagerSheet } from '../../components/OfflineManagerSheet';
import { BookOpen, Clock, Sparkles, Library, X, RotateCcw, Heart } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLibraryStore, SortByField, SortOrderDirection } from '../../stores/useLibraryStore';

export function LibraryScreen() {
  useDocumentTitle();
  const {
    savedPage,
    savedTab,
    savedSearch,
    savedTags,
    savedSortBy,
    savedSortOrder,
    savedScrollY,
    setLibraryState,
    setSort,
  } = useLibraryStore();

  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(savedPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(savedSearch);
  const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'FAVORITE' | 'AI'>(savedTab);
  const [selectedTags, setSelectedTags] = useState<string[]>(savedTags || []);
  const [sortBy, setSortByState] = useState<SortByField>(savedSortBy || 'updatedAt');
  const [sortOrder, setSortOrderState] = useState<SortOrderDirection>(savedSortOrder || 'DESC');

  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoredRef = useRef(false);

  // Sync state to useLibraryStore whenever page, tab, search, selectedTags, sortBy, sortOrder changes
  useEffect(() => {
    setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder);
  }, [page, tab, search, selectedTags, sortBy, sortOrder, setLibraryState]);

  // Track and save scroll position on main container scroll
  const handleMainScroll = () => {
    if (mainScrollRef.current) {
      setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder, mainScrollRef.current.scrollTop);
    }
  };

  // Fetch paginated books directly from backend API with tab, tags, and sort filter
  const fetchBooks = useCallback(
    async (
      targetPage: number,
      querySearch?: string,
      activeTab?: string,
      filterTags?: string[],
      currentSortBy?: SortByField,
      currentSortOrder?: SortOrderDirection
    ) => {
      setLoading(true);
      const q = querySearch !== undefined ? querySearch : search;
      const t = activeTab !== undefined ? activeTab : tab;
      const tg = filterTags !== undefined ? filterTags : selectedTags;
      const sBy = currentSortBy !== undefined ? currentSortBy : sortBy;
      const sOrder = currentSortOrder !== undefined ? currentSortOrder : sortOrder;

      try {
        const res = await BookRepository.getBooks(targetPage, 20, q, t, sBy, sOrder, tg);
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
    [search, tab, selectedTags, sortBy, sortOrder, showToast]
  );

  useEffect(() => {
    fetchBooks(page, search, tab, selectedTags, sortBy, sortOrder);

    const handleRefresh = () => {
      fetchBooks(page, search, tab, selectedTags, sortBy, sortOrder);
    };

    window.addEventListener('app-refresh', handleRefresh);
    window.addEventListener('offline-mode-changed', handleRefresh);
    window.addEventListener('favorites-updated', handleRefresh);

    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
      window.removeEventListener('offline-mode-changed', handleRefresh);
      window.removeEventListener('favorites-updated', handleRefresh);
    };
  }, [page, search, tab, selectedTags, sortBy, sortOrder, isOfflineMode, fetchBooks]);

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
    setLibraryState(newPage, tab, search, selectedTags, sortBy, sortOrder, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(newPage, search, tab, selectedTags, sortBy, sortOrder);
  };

  // Optimized Debounced search handler (650ms delay + immediate clear)
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    setLibraryState(1, tab, val, selectedTags, sortBy, sortOrder, 0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim() === '') {
      fetchBooks(1, '', tab, selectedTags, sortBy, sortOrder);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchBooks(1, val, tab, selectedTags, sortBy, sortOrder);
    }, 650);
  };

  // Immediate search submit handler (e.g. Enter key or Search icon click)
  const handleSearchSubmit = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchBooks(1, search, tab, selectedTags, sortBy, sortOrder);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI') => {
    setTab(newTab);
    setPage(1);
    setLibraryState(1, newTab, search, selectedTags, sortBy, sortOrder, 0);
    fetchBooks(1, search, newTab, selectedTags, sortBy, sortOrder);
  };

  // Tag filter apply handler
  const handleTagFilterApply = (newTags: string[]) => {
    setSelectedTags(newTags);
    setPage(1);
    setLibraryState(1, tab, search, newTags, sortBy, sortOrder, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(1, search, tab, newTags, sortBy, sortOrder);
  };

  // Sort apply handler
  const handleSortApply = (newSortBy: SortByField, newSortOrder: SortOrderDirection) => {
    setSortByState(newSortBy);
    setSortOrderState(newSortOrder);
    setSort(newSortBy, newSortOrder);
    setPage(1);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(1, search, tab, selectedTags, newSortBy, newSortOrder);
  };

  const defaultSortBy: SortByField = tab === 'HISTORY' ? 'lastedReadAt' : 'updatedAt';
  const defaultSortOrder: SortOrderDirection = 'DESC';
  const isCustomSortActive = sortBy !== defaultSortBy || sortOrder !== defaultSortOrder;

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
          onOpenSort={() => setIsSortSheetOpen(true)}
          isCustomSortActive={isCustomSortActive}
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
            ) : tab === 'FAVORITE' ? (
              <Heart size={13} className="text-rose-500 fill-rose-500 shrink-0" />
            ) : tab === 'AI' ? (
              <Sparkles size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <BookOpen size={13} className="text-primary shrink-0" />
            )}
            <span className="truncate">
              {tab === 'HISTORY'
                ? 'LỊCH SỬ ĐỌC'
                : tab === 'FAVORITE'
                ? 'TRUYỆN YÊU THÍCH'
                : tab === 'AI'
                ? 'DỊCH AI'
                : 'TOÀN BỘ SÁCH'}
            </span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Quick Refresh Icon Button */}
            <button
              onClick={() => fetchBooks(page, search, tab, selectedTags, sortBy, sortOrder)}
              className="p-1 rounded-md text-on-surface-variant/60 hover:text-primary hover:bg-surface-container transition-all active:rotate-180"
              title="Làm mới danh sách"
            >
              <RotateCcw size={12} />
            </button>
            <span className="text-[10.5px] font-mono text-on-surface-variant/70 shrink-0">
              {total} truyện
            </span>
          </div>
        </div>

        {/* Navigation Tabs Header */}
        <div className="flex border-t border-outline-variant/15 bg-surface-container-low/50">
          <button
            onClick={() => handleTabChange('ALL')}
            className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              tab === 'ALL'
                ? 'border-primary text-primary bg-surface/80'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Library size={13} />
            <span>Tất cả</span>
          </button>
          <button
            onClick={() => handleTabChange('HISTORY')}
            className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              tab === 'HISTORY'
                ? 'border-amber-400 text-amber-400 bg-surface/80'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Clock size={13} />
            <span>Lịch sử</span>
          </button>
          <button
            onClick={() => handleTabChange('FAVORITE')}
            className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              tab === 'FAVORITE'
                ? 'border-rose-500 text-rose-500 bg-surface/80'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
            title="Truyện yêu thích"
          >
            <Heart size={13} className={tab === 'FAVORITE' ? 'fill-rose-500' : ''} />
            <span>Yêu thích</span>
          </button>
          <button
            onClick={() => handleTabChange('AI')}
            className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              tab === 'AI'
                ? 'border-emerald-400 text-emerald-400 bg-surface/80'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Sparkles size={13} />
            <span>Dịch AI</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 pb-24 relative"
      >
        <LoadingOverlay isLoading={loading && books.length === 0} message="Đang tải danh sách..." />

        {books.length === 0 && !loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
              {tab === 'FAVORITE' ? <Heart size={20} className="text-rose-500" /> : <BookOpen size={20} />}
            </div>
            <p className="text-xs font-medium text-on-surface-variant/60">
              {selectedTags.length > 0
                ? 'Không tìm thấy truyện nào phù hợp với bộ lọc tags'
                : tab === 'HISTORY'
                ? 'Chưa có lịch sử đọc truyện nào'
                : tab === 'FAVORITE'
                ? 'Chưa có truyện nào trong danh sách yêu thích'
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

      {/* Sort Options Bottom Sheet */}
      <SortSheet
        isOpen={isSortSheetOpen}
        currentSortBy={sortBy}
        currentSortOrder={sortOrder}
        defaultSortBy={defaultSortBy}
        defaultSortOrder={defaultSortOrder}
        onApply={handleSortApply}
        onClose={() => setIsSortSheetOpen(false)}
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
