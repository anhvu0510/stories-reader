import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles, Library, X, Clock, Loader2, Save, ArrowRight, Lock, Cloud, Wifi, WifiOff, CheckSquare, Square, Download, ExternalLink, RefreshCw, Trash2, StopCircle, Database } from 'lucide-react';
import { api, Book } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';

import { BottomDock } from '../components/BottomDock';
import { useReaderSettings } from '../contexts/ReaderContext';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function LibraryScreen() {
  const { bookLimit } = useReaderSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState<Book[]>([]);

  const [aiBooks, setAiBooks] = useState<Book[]>([]);

  const initialTab = (searchParams.get('tab') as 'books' | 'history' | 'ai') || 'books';
  const [activeTab, setActiveTab] = useState<'books' | 'history' | 'ai'>(initialTab);

  const initialOffline = api.isOfflineMode();
  const [isOfflineMode, setIsOfflineMode] = useState(initialOffline);
  const {
    isSyncing,
    tasks,
    syncMultipleBooks,
    syncBook,
    cancelSync
  } = useOfflineSync();
  const [downloadedBookIds, setDownloadedBookIds] = useState<Set<string>>(new Set());
  const [refreshCounter, setRefreshCounter] = useState(0);
  const isRefreshingRef = useRef(false);
  const [downloadSession, setDownloadSession] = useState<{ total: number, completed: number, active: boolean, bookIds: string[] } | null>(null);

  useEffect(() => {
    document.title = 'Reader Stories App';
  }, []);

  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    offlineDb.getBooks().then(books => setDownloadedBookIds(new Set(books.map(b => b.bookId))));
    
    // Calculate accurate storage usage
    if (isOfflineMode) {
      offlineDb.getDbSize().then(bytes => {
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        setStorageUsage(`${mb} MB`);
      });
    }
  }, [isSyncing, activeTab, refreshCounter, isOfflineMode]);

  useEffect(() => {
    const handleOfflineModeChanged = (e: CustomEvent) => {
      setIsOfflineMode(e.detail);
    };
    window.addEventListener('offline-mode-changed', handleOfflineModeChanged as EventListener);
    return () => window.removeEventListener('offline-mode-changed', handleOfflineModeChanged as EventListener);
  }, []);

  useEffect(() => {
    if (downloadSession?.active) {
      const completedCount = downloadSession.bookIds.filter(id => downloadedBookIds.has(id)).length;
      if (completedCount !== downloadSession.completed) {
        setDownloadSession(prev => prev ? { ...prev, completed: completedCount } : null);
      }

      const remainingTasks = tasks.filter(t => downloadSession.bookIds.includes(t.bookId));
      if (remainingTasks.length === 0 && completedCount === downloadSession.total && downloadSession.total > 0) {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Đã hoàn tất tải ${completedCount}/${downloadSession.total} truyện`, type: 'success' }
        }));
        setDownloadSession(null);
      }
    }
  }, [downloadedBookIds, tasks, downloadSession]);

  useEffect(() => {
    if (activeTab !== searchParams.get('tab')) {
      setSearchParams({ tab: activeTab });
    }
  }, [activeTab, setSearchParams, searchParams]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (location.hash && !isLoading) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [location.hash, books, aiBooks, isLoading]);

  const [aiPagination, setAiPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [booksPagination, setBooksPagination] = useState({ currentPage: 1, totalPages: 1 });

  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  useEffect(() => {
    const handleRefresh = () => {
      isRefreshingRef.current = true;
      setRefreshCounter(c => c + 1);
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 800);
    return () => clearTimeout(timer);
  }, [search]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastBookElementRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (isLoading) return;

    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoading, hasMore]);

  const loadingRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const reqId = ++loadingRequestRef.current;

    const isRefresh = isRefreshingRef.current;
    isRefreshingRef.current = false;

    if (!isRefresh) {
      setIsLoading(true);

      if (page === 1) {
        setHasMore(true);
        if (activeTab === 'ai') {
          setAiBooks([]);
        } else {
          setBooks([]);
        }
      }
    }

    const fetchData = async () => {
      try {
        const fetchLimit = bookLimit || 20;

        // If it's a refresh, we want to fetch page 1 directly to prevent append duplicate issues, unless page is already 1.
        // Actually, just let the second useEffect reset the page to 1. But wait, if page is currently > 1, 
        // the second useEffect sets page to 1, causing a double render.
        // For simplicity, we just use the current page.

        const targetPage = isRefresh ? 1 : page;

        if (activeTab === 'ai') {
          const res = await api.getBooks(targetPage, debouncedSearch, activeTab.toUpperCase(), fetchLimit, 'online');
          if (!active) return;
          setAiBooks(prev => targetPage === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setAiPagination({ currentPage: targetPage, totalPages });
            setHasMore(targetPage < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === fetchLimit);
          }
        } else {
          const res = await api.getBooks(targetPage, debouncedSearch, activeTab.toUpperCase(), fetchLimit, isOfflineMode ? 'offline' : 'online');
          if (!active) return;
          setBooks(prev => targetPage === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setBooksPagination({ currentPage: targetPage, totalPages });
            setHasMore(targetPage < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === fetchLimit);
          }
        }
      } catch (e) {
        if (!active) return;
        console.error(e);
        if (e instanceof Error && e.message === 'API_DOMAIN_NOT_SET' && !api.isOfflineMode()) {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { message: 'Vui lòng chọn máy chủ để tiếp tục.', type: 'info' }
          }));
          window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { tab: 'servers' } }));
        }
      } finally {
        if (loadingRequestRef.current === reqId) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => { active = false; };
  }, [page, debouncedSearch, activeTab, bookLimit, isOfflineMode, refreshCounter]);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
  }, [activeTab, debouncedSearch, bookLimit, isOfflineMode, refreshCounter]);

  const currentPagination = activeTab === 'ai' ? aiPagination : booksPagination;

  const displayedBooks = activeTab === 'books'
    ? books
    : activeTab === 'history'
      ? books.filter(b => b.totalTranslated > 0 || b.lastReadChapter)
      : aiBooks;

  const setOfflineMode = (offline: boolean) => {
    localStorage.setItem('offlineMode', String(offline));
    setIsOfflineMode(offline);
    if (offline && activeTab === 'ai') {
      setActiveTab('books');
    }
    window.dispatchEvent(new CustomEvent('offline-mode-changed', { detail: offline }));
  };

  const handleDownloadAllOrStop = async () => {
    if (downloadSession?.active) {
      const remainingTasks = tasks.filter(t => downloadSession.bookIds.includes(t.bookId));
      remainingTasks.forEach(t => {
        cancelSync(t.bookId);
      });

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Đã dừng. Tải thành công ${downloadSession.completed}/${downloadSession.total} truyện`, type: 'info' }
      }));
      setDownloadSession(null);
    } else {
      try {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Đang lấy danh sách toàn bộ truyện...`, type: 'info' }
        }));

        const fetchLimit = 9999;
        const res = await api.getBooks(1, debouncedSearch, activeTab.toUpperCase(), fetchLimit, isOfflineMode ? 'offline' : 'online');

        const allBooks = activeTab === 'history'
          ? res.data.filter(b => b.totalTranslated > 0 || b.lastReadChapter)
          : res.data;

        const booksToDownload = allBooks.filter(b => !downloadedBookIds.has(b.bookId));

        if (booksToDownload.length > 0) {
          const bookIds = booksToDownload.map(b => b.bookId);
          syncMultipleBooks(bookIds);
          setDownloadSession({
            total: bookIds.length,
            completed: 0,
            active: true,
            bookIds
          });
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { message: `Bắt đầu tải ${bookIds.length} truyện`, type: 'success' }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { message: `Tất cả truyện trong danh sách đã được tải`, type: 'info' }
          }));
        }
      } catch (err) {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Lỗi khi lấy danh sách truyện`, type: 'error' }
        }));
      }
    }
  };

  const handleClearOfflineDb = async () => {
    if (window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu ngoại tuyến (offline) không? Hành động này không thể hoàn tác.")) {
      try {
        const booksToDelete = await offlineDb.getBooks();
        if (booksToDelete.length > 0) {
          setDeleteProgress({ current: 0, total: booksToDelete.length });
          
          let count = 0;
          for (const book of booksToDelete) {
            await offlineDb.deleteBook(book.bookId);
            count++;
            setDeleteProgress({ current: count, total: booksToDelete.length });
          }
        }
        
        // Final sweep to clear replacements and any orphaned records
        await offlineDb.deleteAllBooks();
        
        setBooks([]);
        setDownloadedBookIds(new Set());
        setStorageUsage(null);
        setDeleteProgress(null);
        window.dispatchEvent(new CustomEvent('app-refresh'));
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Đã xóa toàn bộ dữ liệu', type: 'success' } }));
      } catch (e) {
        setDeleteProgress(null);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Xóa dữ liệu thất bại', type: 'error' } }));
      }
    }
  };

  return (
    <>
      {deleteProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container w-full max-w-[320px] p-6 rounded-3xl flex flex-col items-center shadow-xl border border-error/20">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
              <Trash2 size={24} className="text-error" />
            </div>
            <h3 className="font-bold text-lg mb-4 text-on-surface">Đang xóa dữ liệu...</h3>
            <div className="w-full bg-surface-container-highest rounded-full h-3 mb-3 overflow-hidden shadow-inner">
              <div 
                className="bg-error h-full rounded-full transition-all duration-300 relative overflow-hidden" 
                style={{ width: `${Math.max(5, (deleteProgress.current / deleteProgress.total) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite]"></div>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant font-medium bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/30">
              {deleteProgress.current} / {deleteProgress.total} truyện
            </p>
          </div>
        </div>
      )}

      <header className="bg-surface/75 backdrop-blur-[32px] sticky top-0 z-40 border-b border-outline-variant/20 flex flex-col w-full px-4 pb-4 pt-3 shadow-sm saturate-150">

        {/* Decorative Title */}
        <div className="flex flex-col items-center justify-center mb-4 relative w-full">
          <div className="flex items-center justify-center relative w-full">
            <button 
              onClick={() => setOfflineMode(!isOfflineMode)}
              className="font-serif text-[28px] font-black tracking-tight drop-shadow-lg select-none pb-1 active:scale-[0.98] transition-transform flex items-center justify-center w-full"
              title={isOfflineMode ? "Ngoại tuyến (Nhấn để bật Mạng)" : "Trực tuyến (Nhấn để chuyển Ngoại tuyến)"}
            >
              <div className="flex items-center justify-center">
                <span className="bg-gradient-to-r from-primary via-primary-fixed to-primary bg-clip-text text-transparent animate-gradient-x whitespace-pre">Reader Stor</span>
                <span className="relative inline-flex justify-center isolate">
                   <span className="bg-gradient-to-r from-primary via-primary-fixed to-primary bg-clip-text text-transparent animate-gradient-x">i</span>
                   <span className={`absolute top-[4.5px] left-[50%] -translate-x-1/2 w-[7px] h-[7px] rounded-full transition-colors shadow-sm z-10 ${isOfflineMode ? 'bg-error animate-pulse' : 'bg-green-500'}`}></span>
                </span>
                <span className="bg-gradient-to-r from-primary via-primary-fixed to-primary bg-clip-text text-transparent animate-gradient-x">es</span>
              </div>
            </button>
          </div>
          
          {isOfflineMode && storageUsage && (
             <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant bg-surface-container-low px-2.5 py-0.5 rounded-full border border-outline-variant/30 shadow-sm">
               <Database size={10} className="opacity-70" />
               <span>Dữ liệu đang lưu: <strong className="text-primary font-bold">{storageUsage}</strong></span>
             </div>
          )}
        </div>

        {/* Header Row (Search + Settings) */}
        <div className="flex items-center justify-between gap-3 w-full mx-auto">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
              <Search size={16} />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2.5 bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 rounded-[18px] text-on-surface focus:bg-surface-container focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all text-[15px] outline-none placeholder:text-on-surface-variant/50 shadow-inner"
              placeholder="Tìm kiếm truyện, tác giả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
              {isLoading && search && (
                <Loader2 size={14} className="animate-spin text-primary opacity-60" />
              )}
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="pr-2 flex items-center text-on-surface-variant active:text-on-surface transition-colors focus:outline-none p-2"
                >
                  <div className="bg-surface-variant/50 rounded-full p-1 border border-outline-variant/20 active:bg-surface-variant">
                    <X size={12} />
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Settings Button */}
          <div className="flex items-center gap-2">
            {!isOfflineMode && (
              <button
                onClick={handleDownloadAllOrStop}
                className={`w-11 h-11 rounded-[18px] backdrop-blur-md border text-on-surface-variant transition-all shrink-0 flex items-center justify-center shadow-inner ${downloadSession?.active ? 'bg-error/10 border-error/30 text-error active:bg-error/20 active:scale-95' : 'bg-surface-container-low/50 border-outline-variant/30 active:text-primary active:bg-primary/5 active:scale-95'}`}
                title={downloadSession?.active ? "Dừng tải tất cả" : "Tải tất cả truyện trên trang"}
              >
                {downloadSession?.active ? <StopCircle size={18} /> : <Download size={18} />}
              </button>
            )}
            <button
              onClick={() => setShowGlobalSettings(true)}
              className="w-11 h-11 rounded-[18px] bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 text-on-surface-variant active:text-primary active:bg-primary/5 active:scale-95 transition-all shrink-0 flex items-center justify-center shadow-inner"
              title="Cài đặt Hệ thống"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4 pb-24">
        <section className="flex flex-col gap-4">
          {displayedBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-on-surface-variant text-center px-4 py-12 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/30">
              <Library size={36} className="mb-4 opacity-50" strokeWidth={1} />
              <p className="font-medium text-on-surface">Không có truyện nào</p>
              <p className="text-sm mt-1 opacity-80">
                {!localStorage.getItem('API_DOMAIN_CONFIG')
                  ? ''
                  : activeTab === 'history' ? 'Bạn chưa đọc truyện nào gần đây hoặc cần tải thêm để kiểm tra.' :
                    activeTab === 'ai' ? 'Không có truyện nào đang chờ dịch.' :
                      search ? 'Không tìm thấy truyện phù hợp.' : 'Thư viện trống.'}
              </p>

              {isLoading && currentPagination.currentPage === 1 && (
                <div className="flex items-center gap-2 mt-6">
                  <div className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-surface-container-high rounded-xl font-medium opacity-50 text-sm">
                    Đang tải...
                  </div>
                </div>
              )}
            </div>
          ) : displayedBooks.map((book, index) => {
            const isRead = book.totalTranslated > 0;
            const progress = book.chapterCount > 0 ? (book.totalTranslated / book.chapterCount) * 100 : 0;
            const isLast = index === displayedBooks.length - 1;

            const isDownloaded = downloadedBookIds.has(book.bookId);
            const currentTask = tasks.find(t => t.bookId === book.bookId);
            const isThisBookSyncing = !!currentTask;
            const openInNewTab = activeTab === 'books' || activeTab === 'history';

            const getBookUrl = (book: Book) => {
              if (book?.lastReadChapter && activeTab === 'history') {
                return `/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}?rootTab=${activeTab}`;
              } else {
                const qs = new URLSearchParams();
                if (activeTab === 'ai') qs.set('filterState', 'PENDING');
                qs.set('bookName', book.bookName);
                qs.set('rootTab', activeTab);
                const filterStateStr = qs.toString() ? `?${qs.toString()}` : '';
                return `/book/${book.bookId}${filterStateStr}`;
              }
            };

            return (
              <Link
                id={`book-${book.bookId}`}
                key={book.bookId}
                to={getBookUrl(book)}
                className={`relative overflow-hidden block rounded-2xl p-3 sm:p-4 transition-all duration-300 active:scale-[0.98] ${isRead || activeTab !== 'books'
                  ? 'bg-surface-container-low border border-outline-variant/30 active:bg-surface-container active:border-primary/40'
                  : 'bg-surface border border-outline-variant/20 active:border-outline-variant/40'
                  }`}
              >
                {/* Subtle side indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${isRead || activeTab === 'history' ? 'bg-primary/30' : 'bg-outline-variant/30'
                  }`} />

                <div className="flex items-center gap-3.5 sm:gap-4 pl-1">

                  {/* Left Number Badge for total chapters */}
                  <div className={`shrink-0 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] rounded-full flex flex-col items-center justify-center border font-bold transition-colors ${isRead || activeTab === 'history'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-surface-variant/50 text-on-surface-variant border-outline-variant/30'
                    }`}>
                    <span className="text-[9px] sm:text-[10px] leading-none opacity-80 mt-0.5 uppercase tracking-wider">{activeTab === 'history' && book.lastReadChapter ? 'C.' + book.lastReadChapter.chapterNumber : 'Tổng'}</span>
                    <span className="text-[14px] sm:text-[16px] leading-none mt-0.5">{activeTab === 'history' ? Math.round(progress) + '%' : book.chapterCount}</span>
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-center">
                    <h3 className="text-[14px] sm:text-[15px] font-semibold leading-[1.3] truncate mb-1 text-on-surface transition-colors">
                      {book.bookName}
                    </h3>

                    <div className="flex flex-col gap-1.5 mt-0.5">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {activeTab !== 'history' ? (
                          <>
                            {book.totalTranslated > 0 && (
                              <div className="flex items-center text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-wide bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0 shadow-sm">
                                Đã dịch: {book.totalTranslated}
                              </div>
                            )}
                            {book.totalPending > 0 && (
                              <div className="flex items-center text-[9px] sm:text-[10px] font-bold text-error uppercase tracking-wide bg-error/10 px-1.5 py-0.5 rounded border border-error/20 shrink-0 shadow-sm">
                                Chưa dịch: {book.totalPending}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-primary text-[10px] sm:text-[11px] font-semibold bg-primary/5 border border-primary/10 shadow-sm w-fit max-w-full">
                            <History size={10} className="shrink-0" />
                            <span className="truncate">{book.lastReadChapter?.title ? book.lastReadChapter.title : `Chương ${book.lastReadChapter?.chapterNumber}`}</span>
                          </span>
                        )}
                      </div>

                      {/* Date Row */}
                      <div className="flex items-center text-[10px] sm:text-[11px] text-primary/80 font-medium">
                        <Clock size={10} className="mr-1 opacity-80 shrink-0" />
                        <span className="truncate">{book.updatedAt ? book.updatedAt : book.createdAt ? book.createdAt : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="shrink-0 pr-1 sm:pr-2 flex items-center gap-1.5 sm:gap-2">
                    {isOfflineMode && activeTab === 'books' && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isThisBookSyncing) return;
                          try {
                            await syncBook(book.bookId, book.bookName);
                          } catch (err) {
                            window.dispatchEvent(new CustomEvent('app-toast', {
                              detail: { message: 'Có lỗi xảy ra, vui lòng thử lại sau', type: 'error' }
                            }));
                          }
                        }}
                        disabled={isThisBookSyncing}
                        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-primary/80 active:text-primary bg-primary/10 active:bg-primary/20 rounded-full transition-all active:scale-95 disabled:opacity-100"
                        title="Đồng bộ mới nhất"
                      >
                        {currentTask ? (
                          <div className="relative flex items-center justify-center w-full h-full text-primary">
                            <svg className="absolute w-[80%] h-[80%] -rotate-90 transform" viewBox="0 0 36 36">
                              <path stroke="currentColor" className="opacity-20" fill="none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />
                              <path stroke="currentColor" className="transition-all duration-300" fill="none" strokeWidth="3" strokeDasharray={`${currentTask.totalChapters > 0 ? Math.round((currentTask.completedChapters / Math.max(1, currentTask.totalChapters)) * 100) : currentTask.progress || 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />
                            </svg>
                            <span className="text-[10px] font-bold z-10">{currentTask.totalChapters > 0 ? Math.round((currentTask.completedChapters / Math.max(1, currentTask.totalChapters)) * 100) : currentTask.progress || 0}%</span>
                          </div>
                        ) : (
                          <RefreshCw size={16} />
                        )}
                      </button>
                    )}
                    {isOfflineMode && activeTab === 'books' && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          //if (window.confirm("Bạn có chắc chắn muốn xóa truyện này khỏi máy?")) { // Using just action for now to avoid alert
                          await offlineDb.deleteBook(book.bookId);
                          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Đã xóa truyện', type: 'success' } }));
                          setBooks(prev => prev.filter(b => b.bookId !== book.bookId));
                          window.dispatchEvent(new CustomEvent('app-refresh'));
                          //}
                        }}
                        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-error/80 active:text-error bg-error/10 active:bg-error/20 rounded-full transition-all active:scale-95"
                        title="Xóa truyện"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {activeTab === 'books' && !isOfflineMode && (!isDownloaded || isThisBookSyncing) && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isThisBookSyncing) return;
                          try {
                            await syncBook(book.bookId);
                          } catch (err) {
                            window.dispatchEvent(new CustomEvent('app-toast', {
                              detail: { message: 'Có lỗi xảy ra, vui lòng thử lại sau', type: 'error' }
                            }));
                          }
                        }}
                        disabled={isThisBookSyncing}
                        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-on-surface-variant/60 active:text-primary bg-surface-variant/40 active:bg-primary/10 rounded-full transition-all active:scale-95 disabled:opacity-100"
                        title="Tải về"
                      >
                        {currentTask ? (
                          <div className="relative flex items-center justify-center w-full h-full text-primary">
                            <svg className="absolute w-[80%] h-[80%] -rotate-90 transform" viewBox="0 0 36 36">
                              <path stroke="currentColor" className="opacity-20" fill="none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />
                              <path stroke="currentColor" className="transition-all duration-300" fill="none" strokeWidth="3" strokeDasharray={`${currentTask.totalChapters > 0 ? Math.round((currentTask.completedChapters / Math.max(1, currentTask.totalChapters)) * 100) : currentTask.progress || 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />
                            </svg>
                            <span className="text-[10px] font-bold z-10">{currentTask.totalChapters > 0 ? Math.round((currentTask.completedChapters / Math.max(1, currentTask.totalChapters)) * 100) : currentTask.progress || 0}%</span>
                          </div>
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open('#' + getBookUrl(book), '_blank', 'noopener,noreferrer');
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-on-surface-variant/60 active:text-primary bg-surface-variant/40 active:bg-primary/10 rounded-full transition-all active:scale-95"
                      title="Mở trong tab mới"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}

          {hasMore && (
            <div ref={lastBookElementRef} className="h-4 w-full" aria-hidden="true" />
          )}

          {displayedBooks.length > 0 && hasMore && (
            <div className="py-6 flex justify-center w-full min-h-[72px]">
              {isLoading && page > 1 && <Loader2 className="animate-spin text-primary" size={20} />}
            </div>
          )}
        </section>
      </main>

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} isOfflineMode={isOfflineMode} />
      )}

      <BottomDock
        activeTab={activeTab}
        onTabSelect={setActiveTab}
        isOfflineMode={isOfflineMode}
        onClearDbClick={handleClearOfflineDb}
      />

      <LoadingOverlay isLoading={isLoading && page === 1} message="Đang tải danh sách truyện..." />
    </>
  );
}
