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
import { RefreshCw } from 'lucide-react';

export function LibraryScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'AI'>('ALL');

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);
  const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch paginated books directly from backend API with tab filter (Server-Side Tab Pagination)
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
    fetchBooks(1, search, tab);

    const handleRefresh = () => {
      fetchBooks(1, search, tab);
    };

    window.addEventListener('app-refresh', handleRefresh);
    window.addEventListener('offline-mode-changed', handleRefresh);

    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
      window.removeEventListener('offline-mode-changed', handleRefresh);
    };
  }, [isOfflineMode, search, tab, fetchBooks]);

  // Debounced search handler
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchBooks(1, val, tab);
    }, 300);
  };

  // Tab switch handler: resets page and passes new tab to API
  const handleTabChange = (newTab: 'ALL' | 'HISTORY' | 'AI') => {
    setTab(newTab);
    setPage(1);
    fetchBooks(1, search, newTab);
  };

  return (
    <div className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-28 border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200">
      {/* Header with Essential Shortcut Icons (Wifi & Settings) */}
      <LibraryHeader
        searchQuery={search}
        onSearchChange={handleSearchChange}
        activeTab={tab}
        onTabChange={handleTabChange}
        onOpenSettings={() => openSettings('reader')}
      />

      <main className="px-3.5 pt-3.5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-mono font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            {tab === 'HISTORY'
              ? 'LỊCH SỬ ĐỌC TRUYỆN'
              : tab === 'AI'
              ? 'TRUYỆN CHỜ DỊCH AI'
              : 'DANH SÁCH TRUYỆN'}
          </h2>
          <button
            onClick={() => fetchBooks(page, search, tab)}
            disabled={loading}
            className="p-1.5 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant text-[11px] font-mono flex items-center gap-1 transition-all active:scale-95 hover:bg-surface-container-high"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-primary' : ''} />
            <span>LÀM MỚI</span>
          </button>
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
        onPageChange={(newPage) => fetchBooks(newPage, search, tab)}
      />
    </div>
  );
}
