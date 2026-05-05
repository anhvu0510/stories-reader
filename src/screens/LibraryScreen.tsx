import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles, Library, X, Clock, Loader2, Save, ArrowRight, Lock } from 'lucide-react';
import { api, Book } from '../lib/api';
import { AppView } from '../App';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';

import { BottomDock } from '../components/BottomDock';

export function LibraryScreen({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [aiBooks, setAiBooks] = useState<Book[]>([]);
  
  const initialTab = (searchParams.get('tab') as 'books' | 'history' | 'ai') || 'books';
  const [activeTab, setActiveTab] = useState<'books' | 'history' | 'ai'>(initialTab);

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
      } else {
        setBooks([]);
      }
    }

    const fetchData = async () => {
      try {
        if (activeTab === 'ai') {
          const res = await api.getBooks(page, debouncedSearch, activeTab.toUpperCase(), 20);
          if (!active) return;
          setAiBooks(prev => page === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setAiPagination({ currentPage: page, totalPages });
            setHasMore(page < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === 20);
          }
        } else {
          const res = await api.getBooks(page, debouncedSearch, activeTab.toUpperCase(), 20);
          if (!active) return;
          setBooks(prev => page === 1 ? res.data : [...prev, ...res.data]);
          if (res.pagination) {
            const totalPages = Number(res.pagination.totalPages) || 1;
            setBooksPagination({ currentPage: page, totalPages });
            setHasMore(page < totalPages && res.data.length > 0);
          } else {
            setHasMore(res.data.length === 20);
          }
        }
      } catch (e) {
        if (!active) return;
        console.error(e);
      } finally {
        if (loadingRequestRef.current === reqId) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => { active = false; };
  }, [page, debouncedSearch, activeTab]);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
  }, [activeTab, debouncedSearch]);

  const currentPagination = activeTab === 'ai' ? aiPagination : booksPagination;

  const displayedBooks = activeTab === 'books' 
    ? books 
    : activeTab === 'history' 
      ? books.filter(b => b.totalTranslated > 0)
      : aiBooks;

  return (
    <>
    <header className="bg-surface/75 backdrop-blur-[32px] sticky top-0 z-40 border-b border-outline-variant/20 flex flex-col w-full px-4 pb-4 pt-3 shadow-sm saturate-150">
        {/* Decorative Title */}
        <div className="flex justify-center mb-3">
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
                  className="pr-2 flex items-center text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none p-2"
                >
                  <div className="bg-surface-variant/50 rounded-full p-1 border border-outline-variant/20 hover:bg-surface-variant">
                    <X size={12} />
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Settings Button */}
          <button 
            onClick={() => setShowGlobalSettings(true)}
            className="w-11 h-11 rounded-[18px] bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-primary/5 hover:shadow-sm active:scale-95 transition-all shrink-0 flex items-center justify-center shadow-inner"
            title="Cài đặt Hệ thống"
          >
            <Settings size={22} />
          </button>
        </div>
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
            
            return (
            <article 
              ref={isLast ? lastBookElementRef : null}
              key={book.bookId}
              onClick={() => book?.lastReadChapter && activeTab === 'history' ? onNavigate({ type: 'reader', bookId: book.bookId, chapterId: book.lastReadChapter.chapterId, rootTab: activeTab }) : onNavigate({ type: 'book', bookId: book.bookId, filterState: activeTab === 'ai' ? 'PENDING' : 'all', rootTab: activeTab })}
              className={`relative overflow-hidden block rounded-2xl p-3.5 sm:p-4 transition-all duration-300 group cursor-pointer ${
                isRead || activeTab !== 'books' 
                  ? 'bg-surface-container-low border border-outline-variant/30 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:bg-surface-container hover:border-primary/40 active:scale-[0.98]' 
                  : 'bg-surface border border-outline-variant/20 hover:opacity-100 hover:border-outline-variant/40 active:scale-[0.98]'
              }`}
            >
              {/* Subtle side indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                isRead || activeTab === 'history' ? 'bg-primary/20 group-hover:bg-primary/60' : 'bg-outline-variant/30 group-hover:bg-outline-variant/50'
              }`} />
              
              <div className="flex items-center gap-3.5 sm:gap-4 pl-1">
                {/* Left Number Badge for total chapters */}
                <div className={`shrink-0 w-[60px] h-[60px] sm:w-[48px] sm:h-[48px] rounded-full flex flex-col items-center justify-center border font-bold transition-colors ${
                  isRead || activeTab === 'history' 
                    ? 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-on-primary' 
                    : 'bg-surface-variant/50 text-on-surface-variant border-outline-variant/30'
                }`}>
                  <span className="text-[9px] sm:text-[10px] leading-none opacity-80 mt-0.5 uppercase tracking-wider">{activeTab === 'history' && book.lastReadChapter ? 'C.' + book.lastReadChapter.chapterNumber : 'Tổng'}</span>
                  <span className="text-[14px] sm:text-[16px] leading-none mt-0.5">{activeTab === 'history' ? Math.round(progress) + '%' : book.chapterCount}</span>
                </div>

                {/* Middle Content */}
                <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-center">
                  <h3 className="text-[14px] sm:text-[15px] font-semibold leading-[1.3] truncate mb-1 text-on-surface group-hover:text-primary transition-colors">
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

                {/* Right Arrow */}
                <div className="shrink-0 pr-1">
                  <ArrowRight size={18} className="text-on-surface-variant/30 group-hover:text-primary transition-colors transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </article>
          )})}
          
          {displayedBooks.length > 0 && isLoading && page > 1 && (
            <div className="py-6 flex justify-center w-full">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          )}
        </section>
      </main>

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} />
      )}

      <BottomDock activeTab={activeTab} onTabSelect={setActiveTab} />

      <LoadingOverlay isLoading={isLoading && page === 1} message="Đang tải danh sách truyện..." />
    </>
  );
}
