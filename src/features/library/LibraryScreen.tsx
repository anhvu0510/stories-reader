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
import { useReaderConfigStore } from '../../stores/useReaderConfigStore';

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
  const [page, setPage] = useState(savedPage || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(savedSearch || '');
  const [appliedSearch, setAppliedSearch] = useState(savedSearch || '');
  const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'FAVORITE' | 'AI'>(savedTab);
  const [selectedTags, setSelectedTags] = useState<string[]>(savedTags || []);
  const initialSortBy: SortByField = savedSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const [sortBy, setSortByState] = useState<SortByField>(initialSortBy);
  const [sortOrder, setSortOrderState] = useState<SortOrderDirection>(savedSortOrder || 'DESC');

  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const bookLimit = useReaderConfigStore((state) => state.bookLimit || 20);
  const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoredRef = useRef(false);
  const fetchIdRef = useRef(0);

  // Sync state to useLibraryStore whenever page, tab, search, selectedTags, sortBy, sortOrder changes
  useEffect(() => {
    setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder);
  }, [page, tab, search, selectedTags, sortBy, sortOrder, setLibraryState]);

  // Clean up search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      const q = querySearch !== undefined ? querySearch : appliedSearch;
      const t = activeTab !== undefined ? activeTab : tab;
      const tg = filterTags !== undefined ? filterTags : selectedTags;

      let sBy: SortByField;
      let sOrder: SortOrderDirection = 'DESC';

      if (t === 'HISTORY') {
        sBy = 'lastedReadAt';
      } else if (t === 'ALL') {
        const rawSortBy = currentSortBy !== undefined ? currentSortBy : sortBy;
        sBy = rawSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
        sOrder = currentSortOrder !== undefined ? currentSortOrder : sortOrder;
      } else {
        sBy = 'createdAt';
      }

      try {
        const res = await BookRepository.getBooks(targetPage, bookLimit, q, t, sBy, sOrder, tg);
        if (fetchId !== fetchIdRef.current) return;
        const fetchedBooks = res.books || [];
        const { currentPage, totalPages: pagesCount, total: totalCount } = res.pagination || {};

        setBooks(fetchedBooks);
        setPage(currentPage || targetPage);
        setTotalPages(pagesCount || 1);
        setTotal(totalCount || fetchedBooks.length);
      } catch {
        if (fetchId === fetchIdRef.current) {
          showToast('Không thể tải danh sách truyện', 'error');
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [appliedSearch, tab, selectedTags, sortBy, sortOrder, bookLimit, showToast]
  );

  useEffect(() => {
    fetchBooks(page, appliedSearch, tab, selectedTags, sortBy, sortOrder);

    const handleRefresh = () => {
      fetchBooks(page, appliedSearch, tab, selectedTags, sortBy, sortOrder);
    };

    window.addEventListener('app-refresh', handleRefresh);
    window.addEventListener('offline-mode-changed', handleRefresh);
    window.addEventListener('favorites-updated', handleRefresh);

    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
      window.removeEventListener('offline-mode-changed', handleRefresh);
      window.removeEventListener('favorites-updated', handleRefresh);
    };
  }, [page, appliedSearch, tab, selectedTags, sortBy, sortOrder, isOfflineMode, bookLimit, fetchBooks]);

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
  };

  // Optimized Debounced search handler (400ms delay + immediate clear)
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim() === '') {
      setPage(1);
      setAppliedSearch('');
      setLibraryState(1, tab, '', selectedTags, sortBy, sortOrder, 0);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setAppliedSearch(val);
      setLibraryState(1, tab, val, selectedTags, sortBy, sortOrder, 0);
    }, 400);
  };

  // Immediate search submit handler (e.g. Enter key or Search icon click)
  const handleSearchSubmit = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setPage(1);
    setAppliedSearch(search);
    setLibraryState(1, tab, search, selectedTags, sortBy, sortOrder, 0);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI') => {
    if (newTab === tab) return;
    setTab(newTab);
    setPage(1);
    setLibraryState(1, newTab, search, selectedTags, sortBy, sortOrder, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  };

  // Tag filter apply handler
  const handleTagFilterApply = (newTags: string[]) => {
    setSelectedTags(newTags);
    setPage(1);
    setLibraryState(1, tab, search, newTags, sortBy, sortOrder, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
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
  };

  const defaultSortBy: SortByField = 'createdAt';
  const defaultSortOrder: SortOrderDirection = 'DESC';
  const isCustomSortActive = tab === 'ALL' && (sortBy !== defaultSortBy || sortOrder !== defaultSortOrder);

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
          onOpenSort={tab === 'ALL' ? () => setIsSortSheetOpen(true) : undefined}
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

        {/* Navigation Tabs Header */}
        <div className="flex border-t border-outline-variant/15 bg-surface-container-low/40 backdrop-blur-md px-1 relative">
          {/* Smooth Sliding Underline Indicator Bar */}
          <div
            className="absolute bottom-0 h-[2.5px] rounded-full transition-all duration-300 ease-out z-10"
            style={{
              width: '20%',
              left: tab === 'ALL' ? '2.5%' : tab === 'HISTORY' ? '27.5%' : tab === 'FAVORITE' ? '52.5%' : '77.5%',
              backgroundColor: tab === 'ALL' ? '#f59e0b' : tab === 'HISTORY' ? '#f59e0b' : tab === 'FAVORITE' ? '#f43f5e' : '#34d399',
              boxShadow: tab === 'ALL' ? '0 0 10px rgba(245,158,11,0.7)' : tab === 'HISTORY' ? '0 0 10px rgba(245,158,11,0.7)' : tab === 'FAVORITE' ? '0 0 10px rgba(244,63,94,0.7)' : '0 0 10px rgba(52,211,153,0.7)',
            }}
          />

          <button
            onClick={() => handleTabChange('ALL')}
            className={`flex-1 py-2.5 text-xs transition-colors flex items-center justify-center relative group cursor-pointer ${
              tab === 'ALL'
                ? 'text-amber-400 font-extrabold'
                : 'text-on-surface-variant/75 font-medium hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Library size={13} className="shrink-0 transition-transform group-active:scale-90" />
              <span className="tracking-tight">Tất cả</span>
              {tab === 'ALL' && (
                <span className="text-[9px] font-mono font-extrabold px-1 py-[1px] rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0 leading-none shadow-2xs">
                  {total}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleTabChange('HISTORY')}
            className={`flex-1 py-2.5 text-xs transition-colors flex items-center justify-center relative group cursor-pointer ${
              tab === 'HISTORY'
                ? 'text-amber-400 font-extrabold'
                : 'text-on-surface-variant/75 font-medium hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="shrink-0 transition-transform group-active:scale-90" />
              <span className="tracking-tight">Lịch sử</span>
              {tab === 'HISTORY' && (
                <span className="text-[9px] font-mono font-extrabold px-1 py-[1px] rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0 leading-none shadow-2xs">
                  {total}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleTabChange('FAVORITE')}
            className={`flex-1 py-2.5 text-xs transition-colors flex items-center justify-center relative group cursor-pointer ${
              tab === 'FAVORITE'
                ? 'text-rose-500 font-extrabold'
                : 'text-on-surface-variant/75 font-medium hover:text-on-surface'
            }`}
            title="Truyện yêu thích"
          >
            <div className="flex items-center gap-1.5">
              <Heart
                size={13}
                className={`shrink-0 transition-transform group-active:scale-90 ${
                  tab === 'FAVORITE' ? 'fill-rose-500' : ''
                }`}
              />
              <span className="tracking-tight">Yêu thích</span>
              {tab === 'FAVORITE' && (
                <span className="text-[9px] font-mono font-extrabold px-1 py-[1px] rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0 leading-none shadow-2xs">
                  {total}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleTabChange('AI')}
            className={`flex-1 py-2.5 text-xs transition-colors flex items-center justify-center relative group cursor-pointer ${
              tab === 'AI'
                ? 'text-emerald-400 font-extrabold'
                : 'text-on-surface-variant/75 font-medium hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0 transition-transform group-active:scale-90" />
              <span className="tracking-tight">Dịch AI</span>
              {tab === 'AI' && (
                <span className="text-[9px] font-mono font-extrabold px-1 py-[1px] rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 shrink-0 leading-none shadow-2xs">
                  {total}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 overflow-y-auto hide-scrollbar no-scrollbar px-3.5 py-3 space-y-3 pb-24 relative"
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
            {selectedTags.length > 0 ? (
              <button
                onClick={() => handleTagFilterApply([])}
                className="text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc tags
              </button>
            ) : (
              <button
                onClick={() => openSettings('servers')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all active:scale-95 cursor-pointer mt-1"
              >
                <span>Cấu hình Máy chủ</span>
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
