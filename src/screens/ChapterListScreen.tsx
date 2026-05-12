import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Search, SortDesc, ArrowLeft, Loader2, AlertCircle, Clock, Settings, Download, Cloud } from 'lucide-react';
import { api, Chapter, Book } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { TranslationSheet } from '../components/TranslationSheet';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { BottomDock } from '../components/BottomDock';
import { ChapterList } from '../components/ChapterList';
import { useReaderSettings } from '../contexts/ReaderContext';
import { useOfflineSync } from '../hooks/useOfflineSync';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateStr;
  }
};

export function ChapterListScreen() {
  const { chapterLimit } = useReaderSettings();
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const filterStateParam = searchParams.get('filterState') === 'PENDING' ? 'PENDING' : 'all';
  let filterStateToUse: 'all' | 'PENDING' = filterStateParam;
  let focusChapterId = searchParams.get('focus') || undefined;
  let focusChapterNumberStr = searchParams.get('focusNumber') || undefined;
  let rootTab = searchParams.get('rootTab') || '';
  
  if (!searchParams.get('focus')) {
    try {
      const cached = sessionStorage.getItem(`last_read_${bookId}`);
      if (cached) {
        const data = JSON.parse(cached);
        focusChapterId = data.chapterId;
        focusChapterNumberStr = String(data.chapterNumber);
        if (data.filterState === 'PENDING' || data.filterState === 'all') {
          filterStateToUse = data.filterState;
        }
        if (data.rootTab) {
          rootTab = data.rootTab;
        }
      }
    } catch(e) {}
  }
  
  if (!rootTab && searchParams.get('rootTab')) {
    rootTab = searchParams.get('rootTab') || '';
  }

  const focusChapterNumber = focusChapterNumberStr ? parseInt(focusChapterNumberStr, 10) : undefined;
  const initialBookName = searchParams.get('bookName') || undefined;

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [book, setBook] = useState<Book | null>(initialBookName ? { bookId: bookId!, bookName: initialBookName, chapterCount: 0, totalTranslated: 0, totalPending: 0, createdAt: '', updatedAt: '', lastReadChapter: null as any } : null);
  
  const limit = chapterLimit || 50;
  // Calculate initial page assuming ordered by chapterNumber ascending
  const initialPage = (focusChapterNumber && filterStateParam !== 'PENDING') ? Math.max(1, Math.ceil(focusChapterNumber / limit)) : 1;
  const [minPage, setMinPage] = useState(initialPage);
  const [maxPage, setMaxPage] = useState(initialPage);
  const [hasMoreNext, setHasMoreNext] = useState(true);
  const [hasMorePrev, setHasMorePrev] = useState(initialPage > 1);

  const [sortBy] = useState('chapterNumber');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [filterState, setFilterState] = useState<'all' | 'PENDING'>(filterStateToUse);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

  // Track if we've successfully scrolled to the focused chapter to avoid repeated scrolling
  const [hasScrolled, setHasScrolled] = useState(false);
  const { 
    isSyncing, 
    tasks,
    syncBook
  } = useOfflineSync();

  const currentTask = tasks.find(t => t.bookId === bookId);
  const isThisBookSyncing = !!currentTask;
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    if (bookId) {
      offlineDb.getBooks().then(books => {
        setIsDownloaded(books.some(b => b.bookId === bookId));
      });
    }
  }, [bookId]);


  useEffect(() => {
    if (book?.bookName) {
      document.title = book.bookName;
    } else {
      document.title = 'Reader Stories App';
    }
  }, [book?.bookName]);

  useEffect(() => {
    if (focusChapterId && !hasScrolled && chapters.length > 0) {
      // Mark as scrolled immediately so we don't yank the user later when they load more chapters
      setHasScrolled(true);

      if (filterState === 'PENDING') {
        return;
      }
      
      const el = document.getElementById(`chapter-${focusChapterId}`);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the flash briefly
          el.classList.add('bg-primary/10');
          setTimeout(() => el.classList.remove('bg-primary/10'), 1500);
        }, 300);
      }
    }
  }, [focusChapterId, chapters, hasScrolled, filterState]);

  const [showTranslation, setShowTranslation] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastChapterElementRef = useCallback((node: HTMLAnchorElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (isLoading || !hasMoreNext) return;
    
    // Safety check in case pagination data is stale
    if (maxPage >= pagination.totalPages && pagination.totalPages > 0) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreNext && !isLoading) {
        loadChapters(maxPage + 1, 'append');
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoading, maxPage, pagination.totalPages, hasMoreNext]);

  const prevObserverRef = useRef<IntersectionObserver | null>(null);
  const firstChapterElementRef = useCallback((node: HTMLAnchorElement | null) => {
    if (prevObserverRef.current) prevObserverRef.current.disconnect();
    if (isLoading || !hasMorePrev) return;

    prevObserverRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMorePrev && !isLoading) {
        loadChapters(minPage - 1, 'prepend');
      }
    });
    if (node) prevObserverRef.current.observe(node);
  }, [isLoading, minPage, hasMorePrev]);

  useEffect(() => {
    // In a real app we'd fetch this specific book's details. For now filter from list or search by name
    api.getBooks(1, initialBookName || '').then(res => {
      const b = res.data.find(x => x.bookId === bookId) || res.data[0];
      if (b && b.bookId === bookId) setBook(b);
    });
  }, [bookId, initialBookName]);

  const prevSearchRef = useRef(debouncedSearch);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const loadingRequestRef = useRef(0);

  const loadChapters = async (pageToLoad: number, action: 'append' | 'prepend' | 'reset', overrideSearch?: string) => {
    const currentSearch = typeof overrideSearch !== 'undefined' ? overrideSearch : debouncedSearch;
    
    if (action === 'append' && !hasMoreNext) return;
    if (action === 'prepend' && !hasMorePrev) return;

    const reqId = ++loadingRequestRef.current;
    setIsLoading(true);

    try {
      const res = await api.getChapters(bookId, pageToLoad, limit, sortBy, sortOrder, filterState, currentSearch);
      if (loadingRequestRef.current !== reqId) return;

      const newChapters = res.chapters || [];
      
      setChapters(prev => {
        if (action === 'reset') return newChapters;
        let merged = [...prev];
        if (action === 'append') {
          const toAdd = newChapters.filter((c: Chapter) => !merged.some(p => p.chapterId === c.chapterId));
          merged = [...merged, ...toAdd];
        } else if (action === 'prepend') {
          const toAdd = newChapters.filter((c: Chapter) => !merged.some(p => p.chapterId === c.chapterId));
          merged = [...toAdd, ...merged];
        }
        return merged.sort((a, b) => sortOrder === 'ASC' ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber);
      });

      setPagination(res.pagination || { currentPage: 1, totalPages: 1, total: 0 });
      const maxPages = res.pagination ? Math.max(1, Number(res.pagination.totalPages) || 1) : 1;

      if (action === 'reset') {
        setMinPage(pageToLoad);
        setMaxPage(pageToLoad);
        setHasMoreNext(pageToLoad < maxPages);
        setHasMorePrev(pageToLoad > 1);
      } else if (action === 'append') {
        setMaxPage(pageToLoad);
        setHasMoreNext(pageToLoad < maxPages && newChapters.length > 0);
      } else if (action === 'prepend') {
        setMinPage(pageToLoad);
        setHasMorePrev(pageToLoad > 1);
      }

    } catch (e) {
      console.error("Failed to fetch chapters:", e);
      if (loadingRequestRef.current === reqId) {
        if (action === 'append') setHasMoreNext(false);
        if (action === 'prepend') setHasMorePrev(false);
      }
    } finally {
      if (loadingRequestRef.current === reqId) {
        setIsLoading(false);
      }
    }
  };

  const prevFilterStateRef = useRef(filterState);
  const prevSortOrderRef = useRef(sortOrder);
  const prevSortByRef = useRef(sortBy);
  const prevLimitRef = useRef(limit);

  useEffect(() => {
    // Determine the proper initial page based on state and inputs
    let targetPage = minPage;
    if (prevSearchRef.current !== debouncedSearch ||
        prevFilterStateRef.current !== filterState ||
        prevSortOrderRef.current !== sortOrder ||
        prevSortByRef.current !== sortBy ||
        prevLimitRef.current !== limit) {
        
        prevSearchRef.current = debouncedSearch;
        prevFilterStateRef.current = filterState;
        prevSortOrderRef.current = sortOrder;
        prevSortByRef.current = sortBy;
        prevLimitRef.current = limit;
        targetPage = 1;
    }
    loadChapters(targetPage, 'reset', debouncedSearch);
  }, [bookId, filterState, debouncedSearch, sortOrder, sortBy, limit]);

  return (
    <>
      <header className="bg-surface/80 backdrop-blur-[32px] saturate-150 sticky top-0 w-full z-50 border-b border-outline-variant/20 shadow-sm relative">
        <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
        <div className="flex flex-col w-full px-3 pt-3 pb-4 max-w-reading-max-width mx-auto gap-2 relative z-10">
          <div className="flex justify-between items-start w-full">
            <button 
              onClick={async () => {
                if (isThisBookSyncing) return;
                try {
                  await syncBook(bookId || '', book?.bookName || 'Unknown');
                } catch (err) {
                  window.dispatchEvent(new CustomEvent('app-toast', { 
                    detail: { message: 'Có lỗi xảy ra, vui lòng thử lại sau', type: 'error' }
                  }));
                }
              }}
              disabled={isThisBookSyncing}
              className={`w-10 h-10 flex items-center justify-center transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md ${isThisBookSyncing ? 'text-primary' : 'text-on-surface-variant hover:text-primary'} disabled:opacity-100`}
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
                <Download size={20} />
              )}
            </button>
            
            <div 
              className="flex-1 px-3 flex flex-col items-center pt-1 cursor-pointer transition-transform active:scale-[0.98]" 
              onClick={() => navigate(`/#book-${bookId}`)}
            >
              <h1 className="text-on-surface hover:text-primary font-extrabold text-[16px] sm:text-[18px] text-center line-clamp-2 leading-[1.25] tracking-tight transition-colors">
                {book?.bookName || 'Đang tải...'}
              </h1>
              
              {book && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-on-surface bg-surface-container-high border border-outline-variant/20 px-2 py-1 rounded-md shadow-sm">
                    {book.chapterCount} Chương
                  </span>
                  
                  {book.totalPending > 0 && (
                    <span className="flex items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-md shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning mr-1.5 animate-pulse" />
                      Chờ dịch {book.totalPending}
                    </span>
                  )}
                  
                  {book.totalPending === 0 && book.totalTranslated > 0 && (
                    <span className="flex items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-1 rounded-md shadow-sm">
                      Hoàn thành
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowGlobalSettings(true)}
                className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
                title="Cài đặt hệ thống"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-reading-max-width mx-auto px-4 py-4 w-full pb-32">
        <div className="flex bg-surface-container-low p-1 rounded-full border border-outline-variant/30 w-full mb-4">
          <button 
            onClick={() => { setFilterState('all'); }}
            className={`flex-1 px-4 py-2.5 text-[13px] font-medium rounded-full transition-all ${filterState === 'all' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant active:text-on-surface active:bg-surface-variant/30'}`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => { setFilterState('PENDING'); }}
            className={`flex-1 px-4 py-2.5 text-[13px] font-medium rounded-full transition-all ${filterState === 'PENDING' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant active:text-on-surface active:bg-surface-variant/30'}`}
          >
            Chưa dịch
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full mb-6 relative">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm chương..." 
              className="w-full bg-transparent border border-outline-variant/50 rounded-full py-2 pl-10 pr-4 text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-on-surface-variant"
            />
          </div>
          <button 
            onClick={() => { setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC'); }}
            className="flex items-center justify-center bg-transparent border border-outline-variant/50 rounded-full w-9 h-9 text-on-surface active:bg-surface-variant transition-colors flex-shrink-0"
          >
            <SortDesc size={16} className={`transition-transform duration-300 ${sortOrder === 'ASC' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {filterState === 'PENDING' && chapters.length > 0 && (
          <div className="bg-surface-container-low border border-warning/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-warning mb-1">Có {pagination.total} chương chưa dịch</p>
              <p className="text-[10px] text-on-surface-variant">Đang chờ hệ thống xử lý</p>
            </div>
            <button 
              onClick={() => setShowTranslation(true)}
              className="bg-warning text-warning-on-container px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
              Dịch AI
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:gap-3">
          {hasMorePrev && (
            <div ref={firstChapterElementRef} className="h-4 w-full" aria-hidden="true" />
          )}
          <ChapterList 
            chapters={chapters} 
            activeChapterId={focusChapterId}
            variant="detailed"
            onChapterClick={(chapter) => {
              try {
                sessionStorage.setItem(`last_read_${bookId}`, JSON.stringify({
                  chapterId: chapter.chapterId,
                  chapterNumber: chapter.chapterNumber,
                  filterState: filterState,
                  rootTab: rootTab
                }));
              } catch(e) {}
              const rootTabStr = rootTab ? `&rootTab=${rootTab}` : '';
              navigate(`/book/${bookId}/chapter/${chapter.chapterId}?filterState=${filterState}${rootTabStr}`);
            }}
          />

          {hasMoreNext && (
            <div ref={lastChapterElementRef} className="h-4 w-full" aria-hidden="true" />
          )}

          {chapters.length === 0 && !isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-on-surface-variant mt-4">Không tìm thấy chương nào.</p>
            </div>
          )}
          
          {chapters.length > 0 && hasMoreNext && (
            <div className="py-6 flex justify-center w-full min-h-[72px]">
              {isLoading && maxPage > 1 && <Loader2 className="animate-spin text-primary" size={24} />}
            </div>
          )}
        </div>

      </main>

      {showTranslation && (
        <TranslationSheet 
          onClose={() => setShowTranslation(false)} 
          currentBookId={bookId} 
          currentBookName={book?.bookName} 
          initialTab="batch_chapter" 
          initialSelectedChapters={chapters.filter(c => c.state === 'PENDING').map(c => c.chapterId)} 
          disableCurrent={true}
        />
      )}

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} currentBookId={bookId} />
      )}
      
      <BottomDock 
        activeTab="books"
        onTabSelect={(t) => {
          if (t === 'ai') {
            setShowTranslation(true);
          } else {
            navigate(`/?tab=${t}`);
          }
        }} 
      />
      
      <LoadingOverlay isLoading={isLoading && chapters.length === 0} message="Đang tải danh sách chương..." />
    </>
  );
}
