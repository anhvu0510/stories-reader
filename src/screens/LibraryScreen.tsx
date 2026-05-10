import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles, Library, X, Clock, Loader2, Save, ArrowRight, Lock, Cloud, WifiOff, CheckSquare, Square, Download, ExternalLink, RefreshCw } from 'lucide-react';
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
  const [books, setBooks] = useState<Book[]>([]);
  const [aiBooks, setAiBooks] = useState<Book[]>([]);
  
  const initialTab = (searchParams.get('tab') as 'books' | 'history' | 'ai') || 'books';
  const [activeTab, setActiveTab] = useState<'books' | 'history' | 'ai'>(initialTab);

  const initialOffline = api.isOfflineMode();
  const [isOfflineMode, setIsOfflineMode] = useState(initialOffline);
  
  const [offlineBooks, setOfflineBooks] = useState<Book[]>([]);
  const [bookSubTab, setBookSubTab] = useState<'online' | 'offline'>(initialOffline ? 'offline' : 'online');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const { isSyncing, syncProgress, syncStatus, syncMultipleBooks, syncBook, syncingBookId } = useOfflineSync();
  const [downloadedBookIds, setDownloadedBookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'Reader Stories App';
  }, []);

  useEffect(() => {
    offlineDb.getBooks().then(books => setDownloadedBookIds(new Set(books.map(b => b.bookId))));
  }, [isSyncing, activeTab]);

  useEffect(() => {
    const handleOfflineModeChanged = (e: CustomEvent) => {
      setIsOfflineMode(e.detail);
      setBookSubTab(e.detail ? 'offline' : 'online');
    };
    window.addEventListener('offline-mode-changed', handleOfflineModeChanged as EventListener);
    return () => window.removeEventListener('offline-mode-changed', handleOfflineModeChanged as EventListener);
  }, []);

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

  const [aiPagination, setAiPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [booksPagination, setBooksPagination] = useState({ currentPage: 1, totalPages: 1 });
  
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

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
    setIsLoading(true);

    if (page === 1) {
      setHasMore(true);
      if (activeTab === 'ai') {
        setAiBooks([]);
      } else if (activeTab === 'books' && bookSubTab === 'offline' && !isOfflineMode) {
        setOfflineBooks([]);
      } else {
        setBooks([]);
      }
    }

    const fetchData = async () => {
      try {
        const fetchLimit = bookLimit || 20;

        if (activeTab === 'books' && bookSubTab === 'offline' && !isOfflineMode) {
          const res = await api.getBooks(page, debouncedSearch, activeTab.toUpperCase(), fetchLimit, 'offline');
          if (!active) return;
          setOfflineBooks(prev => page === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setBooksPagination({ currentPage: page, totalPages });
            setHasMore(page < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === fetchLimit);
          }
          return;
        }

        if (activeTab === 'ai') {
          const res = await api.getBooks(page, debouncedSearch, activeTab.toUpperCase(), fetchLimit, 'online');
          if (!active) return;
          setAiBooks(prev => page === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setAiPagination({ currentPage: page, totalPages });
            setHasMore(page < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === fetchLimit);
          }
        } else {
          const res = await api.getBooks(page, debouncedSearch, activeTab.toUpperCase(), fetchLimit, isOfflineMode ? 'offline' : 'online');
          if (!active) return;
          setBooks(prev => page === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setBooksPagination({ currentPage: page, totalPages });
            setHasMore(page < totalPages && res.data.length > 0);
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
  }, [page, debouncedSearch, activeTab, bookLimit, bookSubTab]);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
  }, [activeTab, debouncedSearch, bookLimit, bookSubTab]);

  const currentPagination = activeTab === 'ai' ? aiPagination : booksPagination;

  const displayedBooks = activeTab === 'books' 
    ? (isOfflineMode || bookSubTab === 'online' ? books : offlineBooks)
    : activeTab === 'history' 
      ? books.filter(b => b.totalTranslated > 0 || b.lastReadChapter)
      : aiBooks;

  const setOfflineMode = (offline: boolean) => {
    localStorage.setItem('offlineMode', String(offline));
    setIsOfflineMode(offline);
    setBookSubTab(offline ? 'offline' : 'online');
    window.dispatchEvent(new CustomEvent('offline-mode-changed', { detail: offline }));
  };

  const toggleSelection = (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newSet = new Set(selectedBooks);
    if (newSet.has(bookId)) newSet.delete(bookId);
    else newSet.add(bookId);
    setSelectedBooks(newSet);
  };

  return (
    <>
    <header className="bg-surface/75 backdrop-blur-[32px] sticky top-0 z-40 border-b border-outline-variant/20 flex flex-col w-full px-4 pb-4 pt-3 shadow-sm saturate-150">

        {isSyncing && (
          <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            <div className="w-full bg-surface-container-high h-1.5 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-center text-primary mt-0.5 bg-surface-container-lowest mx-auto px-2 py-0.5 rounded-b-lg w-fit shadow-xs">{syncStatus} ({syncProgress}%)</p>
          </div>
        )}

        {/* Decorative Title */}
        <div className="flex justify-center mb-3 relative">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary drop-shadow-sm select-none">
            Reader Stories
          </h1>
        </div>

        {/* Header Row (Search + Settings) */}
        <div className="flex items-center justify-between gap-3 w-full mx-auto">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
              <Search size={18} />
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
                <Loader2 size={16} className="animate-spin text-primary opacity-60" />
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

          {activeTab === 'books' && bookSubTab === 'online' && !isOfflineMode && (
            <button 
              onClick={() => {
                setIsSelecting(!isSelecting);
                if (isSelecting) setSelectedBooks(new Set());
              }}
              className={`w-11 h-11 rounded-[18px] backdrop-blur-md border transition-all shrink-0 flex items-center justify-center shadow-inner active:scale-95 ${isSelecting ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low/50 border-outline-variant/30 text-on-surface-variant active:text-primary active:bg-primary/5'}`}
              title="Chọn nhiều truyện"
            >
              <Download size={22} />
            </button>
          )}

          {/* Settings Button */}
          {!isOfflineMode && (
            <button 
              onClick={() => setShowGlobalSettings(true)}
              className="w-11 h-11 rounded-[18px] bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 text-on-surface-variant active:text-primary active:bg-primary/5 active:scale-95 transition-all shrink-0 flex items-center justify-center shadow-inner"
              title="Cài đặt Hệ thống"
            >
              <Settings size={22} />
            </button>
          )}
        </div>

        {/* Sub tabs for Books */}
        {activeTab === 'books' && (
          <div className="flex bg-surface-container-highest/50 p-1 rounded-full w-full max-w-[400px] mt-3 mx-auto shadow-inner">
            <button
              onClick={() => { setOfflineMode(false); setIsSelecting(false); setSelectedBooks(new Set()); }}
              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all duration-300 ${bookSubTab === 'online' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20' : 'text-on-surface-variant active:text-on-surface active:bg-surface-variant/30'}`}
            >
              <Cloud size={16} className={bookSubTab === 'online' ? 'text-primary' : 'opacity-60'} />
              Trực tuyến
            </button>
            <button
              onClick={() => { setOfflineMode(true); setIsSelecting(false); setSelectedBooks(new Set()); }}
              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all duration-300 ${bookSubTab === 'offline' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20' : 'text-on-surface-variant active:text-on-surface active:bg-surface-variant/30'}`}
            >
              <WifiOff size={16} className={bookSubTab === 'offline' ? 'text-primary' : 'opacity-60'} />
              Ngoại tuyến
            </button>
          </div>
        )}
        
        {isSelecting && activeTab === 'books' && bookSubTab === 'online' && (
          <div className="flex items-center justify-between mt-3 px-2 py-2 bg-primary/10 rounded-xl border border-primary/20">
            <span className="text-sm font-bold text-primary pl-2">Đã chọn: {selectedBooks.size} truyện</span>
            <button 
              onClick={() => { if (selectedBooks.size > 0) { syncMultipleBooks(Array.from(selectedBooks)); setIsSelecting(false); setSelectedBooks(new Set()); } }}
              disabled={selectedBooks.size === 0 || isSyncing}
              className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-50"
            >
              Bắt đầu tải
            </button>
          </div>
        )}
      </header>

      <main className="flex-grow w-full mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4 pb-24">
        <section className="flex flex-col gap-4">
          {displayedBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-on-surface-variant text-center px-4 py-12 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/30">
              <Library size={48} className="mb-4 opacity-50" strokeWidth={1} />
              <p className="font-medium text-on-surface">Không có truyện nào</p>
              <p className="text-sm mt-1 opacity-80">
                {!localStorage.getItem('API_DOMAIN_CONFIG') 
                 ? 'Vui lòng nhấn biểu tượng cài đặt (bánh răng) ở góc trên bên phải để cấu hình API Domain.' 
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
            
            const isSelected = selectedBooks.has(book.bookId);
            const isDownloaded = downloadedBookIds.has(book.bookId);
            const isThisBookSyncing = syncingBookId === book.bookId;
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
              key={book.bookId}
              to={isSelecting ? "#" : getBookUrl(book)}
              onClick={(e) => {
                if (isSelecting) {
                  toggleSelection(e, book.bookId);
                }
              }}
              className={`relative overflow-hidden block rounded-2xl p-3 sm:p-4 transition-all duration-300 active:scale-[0.98] ${
                isRead || activeTab !== 'books' 
                  ? 'bg-surface-container-low border border-outline-variant/30 active:bg-surface-container active:border-primary/40' 
                  : isSelected ? 'bg-primary/5 border border-primary/40' : 'bg-surface border border-outline-variant/20 active:border-outline-variant/40'
              }`}
            >
              {/* Subtle side indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                isSelected ? 'bg-primary' : isRead || activeTab === 'history' ? 'bg-primary/30' : 'bg-outline-variant/30'
              }`} />

              {/* Subtle top loading indicator */}
              {isThisBookSyncing && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-surface-variant overflow-hidden z-20">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.max(1, syncProgress)}%` }}
                  />
                </div>
              )}
              
              <div className="flex items-center gap-3.5 sm:gap-4 pl-1">
                
                {isSelecting && (
                  <div 
                    className="shrink-0 flex items-center justify-center p-2 -ml-1 text-on-surface-variant transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="text-primary" size={24} />
                    ) : (
                      <Square size={24} />
                    )}
                  </div>
                )}

                {/* Left Number Badge for total chapters */}
                <div className={`shrink-0 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] rounded-full flex flex-col items-center justify-center border font-bold transition-colors ${
                  isRead || activeTab === 'history' 
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
                  {!isSelecting && !isOfflineMode && activeTab === 'books' && (
                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await syncBook(book.bookId);
                      }}
                      disabled={isSyncing}
                      className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-on-surface-variant/60 active:text-primary bg-surface-variant/40 active:bg-primary/10 rounded-full transition-all active:scale-95 disabled:opacity-50"
                      title={isDownloaded ? "Đồng bộ" : "Tải về"}
                    >
                      {isDownloaded ? (
                        <RefreshCw size={18} className={isThisBookSyncing ? "animate-spin" : ""} />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                  )}
                  {!isSelecting && (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(getBookUrl(book), '_blank', 'noopener,noreferrer');
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-on-surface-variant/60 active:text-primary bg-surface-variant/40 active:bg-primary/10 rounded-full transition-all active:scale-95"
                      title="Mở trong tab mới"
                    >
                      <ExternalLink size={18} />
                    </button>
                  )}
                </div>
              </div>
            </Link>
          )})}
          
          {hasMore && (
            <div ref={lastBookElementRef} className="h-4 w-full" aria-hidden="true" />
          )}

          {displayedBooks.length > 0 && hasMore && (
            <div className="py-6 flex justify-center w-full min-h-[72px]">
              {isLoading && page > 1 && <Loader2 className="animate-spin text-primary" size={24} />}
            </div>
          )}
        </section>
      </main>

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} />
      )}

      <BottomDock 
        activeTab={activeTab} 
        onTabSelect={setActiveTab} 
        isOfflineMode={isOfflineMode} 
        onSettingsClick={() => setShowGlobalSettings(true)}
      />

      <LoadingOverlay isLoading={isLoading && page === 1} message="Đang tải danh sách truyện..." />
    </>
  );
}
