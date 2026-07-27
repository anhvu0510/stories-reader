import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookRepository } from '../../repositories/BookRepository';
import { Book } from '../../shared/types';
import { useToastStore } from '../../stores/useToastStore';
import { useModalStore } from '../../stores/useModalStore';
import { useAppStore } from '../../stores/useAppStore';
import { BookCard } from './components/BookCard';
import { LibraryHeader } from './components/LibraryHeader';
import { BottomDock } from '../../components/BottomDock';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { OfflineManagerSheet } from '../../components/OfflineManagerSheet';
import { BookOpen, Clock, Sparkles, Library } from 'lucide-react';

import { useLibraryStore } from '../../stores/useLibraryStore';

export function LibraryScreen() {
  const { savedPage, savedTab, savedSearch, savedScrollY, setLibraryState } = useLibraryStore();

  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(savedPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(savedSearch);
  const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'AI'>(savedTab);

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoredRef = useRef(false);

  // Sync state to useLibraryStore whenever page, tab, or search changes
  useEffect(() => {
    setLibraryState(page, tab, search);
  }, [page, tab, search, setLibraryState]);

  // Track and save scroll position on main container scroll
  const handleMainScroll = () => {
    if (mainScrollRef.current) {
      setLibraryState(page, tab, search, mainScrollRef.current.scrollTop);
    }
  };

  // Fetch paginated books directly from backend API with tab filter
  const fetchBooks = useCallback(
    async (targetPage: number, querySearch?: string, activeTab?: string) => {
      setLoading(true);
      const q = querySearch !== undefined ? querySearch : search;
      const t = activeTab !== undefined ? activeTab : tab;
      try {
        const res = await BookRepository.getBooks(targetPage, 20, q, t);
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
    [showToast]
  );

  useEffect(() => {
    fetchBooks(page, search, tab);

    const handleRefresh = () => {
      fetchBooks(page, search, tab);
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
      if (savedScrollY > 0 && mainScrollRef.current) {
        requestAnimationFrame(() => {
          if (mainScrollRef.current) {
            mainScrollRef.current.scrollTop = savedScrollY;
          }
        });
      }
    }
  }, [loading, books, savedScrollY]);

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setLibraryState(newPage, tab, search, 0);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    fetchBooks(newPage, search, tab);
  };

  // Optimized Debounced search handler (650ms delay + immediate clear)
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    setLibraryState(1, tab, val, 0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim() === '') {
      fetchBooks(1, '', tab);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchBooks(1, val, tab);
    }, 650);
  };

  // Immediate search submit handler (e.g. Enter key or Search icon click)
  const handleSearchSubmit = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchBooks(1, search, tab);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'AI') => {
    setTab(newTab);
    setPage(1);
    setLibraryState(1, newTab, search, 0);
    fetchBooks(1, search, newTab);
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
        />

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
              {tab === 'HISTORY'
                ? 'Chưa có lịch sử đọc truyện nào'
                : tab === 'AI'
                ? 'Không có truyện nào đang chờ dịch AI'
                : 'Không tìm thấy truyện nào trong thư viện'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {books.map((book) => (
              <BookCard key={book.bookId} book={book} activeTab={tab} />
            ))}
          </div>
        )}
      </main>

      {/* Global Settings & Modals */}
      <GlobalSettingsSheet />
      {isOfflineManagerOpen && <OfflineManagerSheet onClose={closeOfflineManager} />}

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
