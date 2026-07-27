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
import { RefreshCw, BookOpen, Clock, Sparkles } from 'lucide-react';

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

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoredRef = useRef(false);

  // Sync state to useLibraryStore whenever page, tab, or search changes
  useEffect(() => {
    setLibraryState(page, tab, search);
  }, [page, tab, search, setLibraryState]);

  // Track and save scroll Y position on scroll
  useEffect(() => {
    const handleScroll = () => {
      setLibraryState(page, tab, search, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [page, tab, search, setLibraryState]);

  // Fetch paginated books directly from backend API with tab filter
  const fetchBooks = useCallback(
    async (targetPage: number, querySearch: string = search, activeTab: string = tab) => {
      setLoading(true);
      try {
        const res = await BookRepository.getBooks(targetPage, 20, querySearch, activeTab);
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
    [search, tab, showToast]
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
  }, [isOfflineMode, fetchBooks]);

  // Restore scroll position after initial loading finishes
  useEffect(() => {
    if (!loading && books.length > 0 && !isRestoredRef.current) {
      isRestoredRef.current = true;
      if (savedScrollY > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedScrollY, behavior: 'instant' });
        });
      }
    }
  }, [loading, books, savedScrollY]);

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setLibraryState(newPage, tab, search, 0);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    fetchBooks(newPage, search, tab);
  };

  // Debounced search handler
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    setLibraryState(1, tab, val, 0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchBooks(1, val, tab);
    }, 300);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'AI') => {
    setTab(newTab);
    setPage(1);
    setLibraryState(1, newTab, search, 0);
    fetchBooks(1, search, newTab);
  };

  return (
    <div className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-28 border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden hide-scrollbar transition-colors duration-200">
      {/* Header with Essential Shortcut Icons (Wifi & Settings) */}
      <LibraryHeader
        searchQuery={search}
        onSearchChange={handleSearchChange}
        onOpenSettings={() => openSettings('reader')}
      />

      <main className="px-3.5 pt-3.5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-[11px] font-mono font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 min-w-0 truncate">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0"></span>
            <span className="truncate">
              {tab === 'HISTORY'
                ? 'LỊCH SỬ ĐỌC TRUYỆN'
                : tab === 'AI'
                ? 'TRUYỆN CHỜ DỊCH AI'
                : 'DANH SÁCH TRUYỆN'}
            </span>
          </h2>

          {/* Action Icon Group: All, History, Pending AI, Refresh (Icon-Only) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* All Books Icon */}
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

            {/* History Filter Icon */}
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

            {/* Pending AI Translation Filter Icon (Online Only) */}
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

            {/* Refresh Button (Icon Only) */}
            <button
              onClick={() => fetchBooks(page, search, tab)}
              disabled={loading}
              className="p-1.5 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all active:scale-95 hover:bg-surface-container-high"
              title="Làm mới danh sách"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
        </div>

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
