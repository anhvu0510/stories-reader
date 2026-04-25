import { useState, useEffect } from 'react';
import { Search, SortDesc, CheckCircle2, Lock, ArrowLeft, Loader2, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import { api, Chapter, Book } from '../lib/api';
import { AppView } from '../App';
import { TranslationSheet } from '../components/TranslationSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';

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

export function ChapterListScreen({ bookId, filterState: initialFilterState = 'all', onNavigate }: { bookId: string, filterState?: 'all' | 'PENDING', onNavigate: (v: AppView) => void }) {
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
  const [isLoading, setIsLoading] = useState(false);

  const limit = 9999;

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

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    api.getChapters(bookId, page, limit, sortBy, sortOrder, filterState, debouncedSearch).then(res => {
      if (!active) return;
      setChapters(res.chapters || []);
      setPagination(res.pagination || { currentPage: 1, totalPages: 1, total: 0 });
      setIsLoading(false);
    }).catch(() => {
      if (!active) return;
      setIsLoading(false);
    });
    
    return () => { active = false; };
  }, [bookId, page, limit, sortBy, sortOrder, filterState, debouncedSearch]);

  return (
    <>
      <header className="bg-background/90 backdrop-blur-xl sticky top-0 w-full z-50 border-b border-surface-variant">
        <div className="flex justify-between items-center w-full px-4 h-14 max-w-reading-max-width mx-auto">
          <button onClick={() => onNavigate({ type: 'library' })} className="text-primary hover:text-primary-fixed transition-colors active:opacity-70 p-2 -ml-2 rounded-full flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-primary font-bold text-sm sm:text-base truncate px-4 flex-1 text-center">
            {book?.bookName || 'Đang tải...'}
          </h1>
          <div className="w-9 flex-shrink-0"></div>
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
            onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
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

        <div className="flex flex-col gap-3">
          {chapters.map((chapter) => {
            const isPending = chapter.state === 'PENDING';
            const isFailed = chapter.state === 'FAILED';
            const isSucceeded = chapter.state === 'SUCCEEDED';
            
            return (
              <a 
                key={chapter.chapterId}
                onClick={(e) => {
                  e.preventDefault();
                  if (isSucceeded || isPending) onNavigate({ type: 'reader', bookId, chapterId: chapter.chapterId });
                }}
                className={`block rounded-2xl p-4 transition-all group border
                  ${isSucceeded ? 'bg-surface-container border-outline-variant/30 hover:border-primary/50 hover:shadow-sm cursor-pointer' : 
                    isPending ? 'bg-surface-container border-outline-variant/30 hover:border-outline-variant/60 hover:bg-surface-container-high cursor-pointer' : 
                    'bg-surface-container-low border-transparent opacity-60 cursor-not-allowed'}
                `}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${
                        isSucceeded ? 'bg-primary/15 text-primary' : 
                        isPending ? 'bg-amber-500/15 text-amber-500' : 
                        'bg-red-500/15 text-red-500'
                      }`}>
                        Chương {chapter.chapterNumber}
                      </span>
                      
                      <div className="flex items-center text-[11px] text-on-surface-variant font-medium opacity-80 whitespace-nowrap">
                        <Clock size={12} className="mr-1.5" />
                        <span>{formatDate(chapter.updatedAt)}</span>
                      </div>
                    
                      {isFailed && <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-wide ml-auto">Lỗi dịch</span>}
                    </div>
                    
                    <div className="flex-shrink-0 self-center">
                      {isSucceeded && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-primary/60 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
                          <CheckCircle2 size={18} />
                        </div>
                      )}
                      {isPending && (
                         <div className="w-8 h-8 rounded-full flex items-center justify-center text-amber-500/80">
                          <Lock size={16} />
                        </div>
                      )}
                      {isFailed && (
                         <div className="w-8 h-8 rounded-full flex items-center justify-center text-red-500/80">
                          <AlertCircle size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <h3 className={`text-[15px] sm:text-base font-semibold leading-snug transition-colors ${
                    isSucceeded ? 'text-on-surface group-hover:text-primary' : 'text-on-surface-variant'
                  }`}>
                    {chapter.title}
                  </h3>
                </div>
              </a>
            );
          })}

          {chapters.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-on-surface-variant mt-4">Không tìm thấy chương nào.</p>
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
      
      <LoadingOverlay isLoading={isLoading} message="Đang tải danh sách chương..." />
    </>
  );
}
