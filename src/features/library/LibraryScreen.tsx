import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
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

        {/* Navigation Tabs Header - 3D Pop-Out Glass Tabs */}
        <div className="p-1.5 border-t border-white/10 bg-white/[0.03] dark:bg-white/[0.05] backdrop-blur-xl">
          <div className="flex items-center gap-1 bg-black/15 dark:bg-black/30 p-1 rounded-lg border border-white/10 relative">
            {/* Tab 1: Tất cả */}
            <button
              onClick={() => handleTabChange('ALL')}
              className={`flex-1 py-2 px-1 text-xs transition-all flex items-center justify-center relative group cursor-pointer select-none rounded-md active:scale-[0.97] ${
                tab === 'ALL'
                  ? 'text-primary font-black drop-shadow-xs'
                  : 'text-on-surface-variant/75 font-semibold hover:text-on-surface'
              }`}
            >
              {tab === 'ALL' && (
                <motion.div
                  layoutId="active-liquid-tab-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-md bg-white/[0.14] dark:bg-white/[0.14] backdrop-blur-xl border border-primary/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_inset_0_-1px_1px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)] pointer-events-none"
                />
              )}
              <div className="flex items-center gap-1 min-w-0 relative z-10">
                <Library size={13} className={`shrink-0 transition-transform group-active:scale-90 ${tab === 'ALL' ? 'text-primary' : ''}`} />
                <span className="tracking-tight whitespace-nowrap text-[11.5px] sm:text-xs">Tất cả</span>
                {tab === 'ALL' && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-[1px] rounded-full bg-primary/20 text-primary border border-primary/40 shrink-0 leading-none shadow-2xs">
                    {total}
                  </span>
                )}
              </div>
            </button>

            {/* Tab 2: Lịch sử */}
            <button
              onClick={() => handleTabChange('HISTORY')}
              className={`flex-1 py-2 px-1 text-xs transition-all flex items-center justify-center relative group cursor-pointer select-none rounded-md active:scale-[0.97] ${
                tab === 'HISTORY'
                  ? 'text-primary font-black drop-shadow-xs'
                  : 'text-on-surface-variant/75 font-semibold hover:text-on-surface'
              }`}
            >
              {tab === 'HISTORY' && (
                <motion.div
                  layoutId="active-liquid-tab-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-md bg-white/[0.14] dark:bg-white/[0.14] backdrop-blur-xl border border-primary/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_inset_0_-1px_1px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)] pointer-events-none"
                />
              )}
              <div className="flex items-center gap-1 min-w-0 relative z-10">
                <Clock size={13} className={`shrink-0 transition-transform group-active:scale-90 ${tab === 'HISTORY' ? 'text-primary' : ''}`} />
                <span className="tracking-tight whitespace-nowrap text-[11.5px] sm:text-xs">Lịch sử</span>
                {tab === 'HISTORY' && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-[1px] rounded-full bg-primary/20 text-primary border border-primary/40 shrink-0 leading-none shadow-2xs">
                    {total}
                  </span>
                )}
              </div>
            </button>

            {/* Tab 3: Yêu thích */}
            <button
              onClick={() => handleTabChange('FAVORITE')}
              className={`flex-1 py-2 px-1 text-xs transition-all flex items-center justify-center relative group cursor-pointer select-none rounded-md active:scale-[0.97] ${
                tab === 'FAVORITE'
                  ? 'text-rose-500 font-black drop-shadow-xs'
                  : 'text-on-surface-variant/75 font-semibold hover:text-on-surface'
              }`}
              title="Truyện yêu thích"
            >
              {tab === 'FAVORITE' && (
                <motion.div
                  layoutId="active-liquid-tab-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-md bg-white/[0.14] dark:bg-white/[0.14] backdrop-blur-xl border border-rose-500/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_inset_0_-1px_1px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)] pointer-events-none"
                />
              )}
              <div className="flex items-center gap-1 min-w-0 relative z-10">
                <Heart
                  size={13}
                  className={`shrink-0 transition-transform group-active:scale-90 ${
                    tab === 'FAVORITE' ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
                <span className="tracking-tight whitespace-nowrap text-[11.5px] sm:text-xs">Yêu thích</span>
                {tab === 'FAVORITE' && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-[1px] rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0 leading-none shadow-2xs">
                    {total}
                  </span>
                )}
              </div>
            </button>

            {/* Tab 4: Dịch AI */}
            <button
              onClick={() => handleTabChange('AI')}
              className={`flex-1 py-2 px-1 text-xs transition-all flex items-center justify-center relative group cursor-pointer select-none rounded-md active:scale-[0.97] ${
                tab === 'AI'
                  ? 'text-emerald-400 font-black drop-shadow-xs'
                  : 'text-on-surface-variant/75 font-semibold hover:text-on-surface'
              }`}
            >
              {tab === 'AI' && (
                <motion.div
                  layoutId="active-liquid-tab-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-md bg-white/[0.14] dark:bg-white/[0.14] backdrop-blur-xl border border-emerald-400/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_inset_0_-1px_1px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)] pointer-events-none"
                />
              )}
              <div className="flex items-center gap-1 min-w-0 relative z-10">
                <Sparkles size={13} className={`shrink-0 transition-transform group-active:scale-90 ${tab === 'AI' ? 'text-emerald-400' : ''}`} />
                <span className="tracking-tight whitespace-nowrap text-[11.5px] sm:text-xs">Dịch AI</span>
                {tab === 'AI' && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-[1px] rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 shrink-0 leading-none shadow-2xs">
                    {total}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 overflow-y-auto hide-scrollbar no-scrollbar px-3.5 py-3 space-y-3 pb-24 relative"
      >
        {loading && books.length === 0 ? (
          <div className="space-y-3 relative">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-28 rounded-2xl bg-white/[0.03] border border-outline-variant/30 animate-pulse p-3 flex gap-3 opacity-60"
              >
                <div className="w-16 h-20 bg-on-surface-variant/20 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-3/4 bg-on-surface-variant/20 rounded" />
                  <div className="h-3 w-1/2 bg-on-surface-variant/20 rounded" />
                  <div className="h-3 w-1/4 bg-primary/20 rounded pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : books.length === 0 && !loading ? (
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

      {/* Crystal See-Through Glass Loading Overlay */}
      <LoadingOverlay isLoading={loading} />

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
