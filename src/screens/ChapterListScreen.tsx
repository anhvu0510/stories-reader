import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, SortDesc, ArrowLeft, Loader2, AlertCircle, Clock, Settings } from 'lucide-react';
import { api, Chapter, Book } from '../lib/api';
import { AppView } from '../App';
import { TranslationSheet } from '../components/TranslationSheet';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { BottomDock } from '../components/BottomDock';
import { ChapterList } from '../components/ChapterList';

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

export function ChapterListScreen({ bookId, filterState: initialFilterState = 'all', rootTab, onNavigate }: { bookId: string, rootTab: string, filterState?: 'all' | 'PENDING', onNavigate: (v: AppView) => void }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  
  const [page, setPage] = useState(1);
  const [sortBy] = useState('chapterNumber');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [filterState, setFilterState] = useState<'all' | 'PENDING'>(initialFilterState);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });
  const [showTranslation, setShowTranslation] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const limit = 50;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastChapterElementRef = useCallback((node: HTMLAnchorElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (isLoading || !hasMore) return;
    
    // Safety check in case pagination data is stale
    if (page >= pagination.totalPages && pagination.totalPages > 0) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoading, page, pagination.totalPages, hasMore]);

  useEffect(() => {
    // In a real app we'd fetch this specific book's details. For now filter from list.
    api.getBooks().then(res => {
      const b = res.data.find(x => x.bookId === bookId);
      if (b) setBook(b);
    });
  }, [bookId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const loadingRequestRef = useRef(0);

  useEffect(() => {
    // Reset pagination state immediately when dependencies change to prevent stale observer triggers
    if (page === 1) {
      setPagination({ currentPage: 1, totalPages: 1, total: 0 });
      // Clearing chapters early prevents UI jumping and old data acting as stale state.
      setChapters([]);
      setHasMore(true);
    }
    
    let active = true;
    const reqId = ++loadingRequestRef.current;
    setIsLoading(true);
    
    api.getChapters(bookId, page, limit, sortBy, sortOrder, filterState, debouncedSearch)
      .then(res => {
        if (!active) return;
        const newChapters = res.chapters || [];
        setChapters(prev => page === 1 ? newChapters : [...prev, ...newChapters]);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, total: 0 });
        
        const maxPages = res.pagination ? Math.max(1, Number(res.pagination.totalPages) || 1) : 1;
        if (newChapters.length < limit || page >= maxPages) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      })
      .catch((e) => {
        console.error("Failed to fetch chapters:", e);
        if (active) setHasMore(false);
      })
      .finally(() => {
        if (loadingRequestRef.current === reqId) {
          setIsLoading(false);
        }
      });
    
    return () => { active = false; };
  }, [bookId, page, limit, sortBy, sortOrder, filterState, debouncedSearch]);

  return (
    <>
      <header className="bg-surface/80 backdrop-blur-[32px] saturate-150 sticky top-0 w-full z-50 border-b border-outline-variant/20 shadow-sm relative">
        <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
        <div className="flex flex-col w-full px-3 pt-3 pb-4 max-w-reading-max-width mx-auto gap-2 relative z-10">
          <div className="flex justify-between items-start w-full">
            <button 
              onClick={() => onNavigate({ type: 'library' })} 
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
            >
              <ArrowLeft size={20} />
            </button>
            
            <div className="flex-1 px-3 flex flex-col items-center pt-1">
              <h1 className="text-on-surface font-extrabold text-[16px] sm:text-[18px] text-center line-clamp-2 leading-[1.25] tracking-tight">
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

            <button 
              onClick={() => setShowGlobalSettings(true)}
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Cài đặt hệ thống"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-reading-max-width mx-auto px-4 py-4 w-full pb-32">
        <div className="flex bg-surface-container-low p-1 rounded-full border border-outline-variant/30 w-full mb-4">
          <button 
            onClick={() => { setFilterState('all'); setPage(1); }}
            className={`flex-1 px-4 py-2.5 text-[13px] font-medium rounded-full transition-all ${filterState === 'all' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => { setFilterState('PENDING'); setPage(1); }}
            className={`flex-1 px-4 py-2.5 text-[13px] font-medium rounded-full transition-all ${filterState === 'PENDING' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
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
            onClick={() => { setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC'); setPage(1); }}
            className="flex items-center justify-center bg-transparent border border-outline-variant/50 rounded-full w-9 h-9 text-on-surface hover:bg-surface-variant transition-colors flex-shrink-0"
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
              Dịch nhanh
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:gap-3">
          <ChapterList 
            chapters={chapters} 
            variant="detailed"
            onChapterClick={(chapter) => {
              onNavigate({ type: 'reader', bookId, chapterId: chapter.chapterId, rootTab });
            }}
            lastChapterElementRef={lastChapterElementRef}
          />

          {chapters.length === 0 && !isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-on-surface-variant mt-4">Không tìm thấy chương nào.</p>
            </div>
          )}
          
          {chapters.length > 0 && isLoading && page > 1 && (
            <div className="py-6 flex justify-center w-full">
              <Loader2 className="animate-spin text-primary" size={24} />
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
        />
      )}

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} currentBookId={bookId} />
      )}
      
      <BottomDock 
        activeTab={rootTab as 'books' | 'history' | 'ai'} 
        onTabSelect={(t) => onNavigate({ type: 'library', tab: t })} 
      />
      
      <LoadingOverlay isLoading={isLoading && page === 1} message="Đang tải danh sách chương..." />
    </>
  );
}
