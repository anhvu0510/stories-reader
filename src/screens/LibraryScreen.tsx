import { useState, useEffect, useRef } from 'react';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles, Library, X, Clock, Loader2, Save } from 'lucide-react';
import { api, Book } from '../lib/api';
import { AppView } from '../App';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';

export function LibraryScreen({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [aiBooks, setAiBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'books' | 'history' | 'ai'>('books');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [aiPagination, setAiPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [booksPagination, setBooksPagination] = useState({ currentPage: 1, totalPages: 1 });
  
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadBooks = async (pageNum: number, searchKeyword: string, currentTab: string) => {
    setIsLoading(true);
    try {
      if (currentTab === 'ai') {
        const res = await api.getBooks(pageNum, searchKeyword, currentTab.toUpperCase(), 20);
        setAiBooks(res.data);
        if (res.pagination) {
          const totalPages = Number(res.pagination.totalPages) || 1;
          setAiPagination({ currentPage: pageNum, totalPages });
          setHasMore(pageNum < totalPages);
        }
      } else {
        const res = await api.getBooks(pageNum, searchKeyword, currentTab.toUpperCase(), 20);
        setBooks(res.data);
        if (res.pagination) {
          const totalPages = Number(res.pagination.totalPages) || 1;
          setBooksPagination({ currentPage: pageNum, totalPages });
          setHasMore(pageNum < totalPages);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadBooks(1, debouncedSearch, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, debouncedSearch]);

  const currentPagination = activeTab === 'ai' ? aiPagination : booksPagination;

  const handlePageChange = (newPage: number) => {
    console.log({newPage})
    if (isLoading || newPage < 1 || newPage > currentPagination.totalPages) return;
    setPage(newPage);
    loadBooks(newPage, debouncedSearch, activeTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const displayedBooks = activeTab === 'books' 
    ? books 
    : activeTab === 'history' 
      ? books.filter(b => b.totalTranslated > 0)
      : aiBooks;

  return (
    <>
      <header className="bg-surface/75 backdrop-blur-[32px] sticky top-0 z-40 border-b border-outline-variant/20 flex flex-col w-full pb-4 pt-4 shadow-sm saturate-150">
        {/* Top Header Row (Search + Settings) */}
        <div className="px-4 flex items-center justify-between gap-3 w-full mx-auto">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
              <Search size={18} />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2.5 sm:py-3 bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 rounded-[18px] text-on-surface focus:bg-surface-container focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all text-[15px] sm:text-sm outline-none placeholder:text-on-surface-variant/50 shadow-inner"
              placeholder="Tìm kiếm truyện, tác giả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none p-2"
              >
                <div className="bg-surface-variant/50 rounded-full p-1 border border-outline-variant/20 hover:bg-surface-variant">
                  <X size={12} />
                </div>
              </button>
            )}
          </div>

          {/* Settings Button */}
          <button 
            onClick={() => setShowGlobalSettings(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-[18px] bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-primary/5 hover:shadow-sm active:scale-95 transition-all shrink-0 flex items-center justify-center shadow-inner"
            title="Cài đặt Hệ thống"
          >
            <Settings size={22} />
          </button>
        </div>

        {/* Header Tabs */}
        <div className="px-4 w-full mx-auto mt-3.5">
          <div className="flex items-center p-1.5 rounded-[20px] w-full bg-surface-container-lowest/40 backdrop-blur-xl border border-outline-variant/20 shadow-inner overflow-x-auto hide-scrollbar relative">
             {/* We can use absolute positioning for active indicator if we want, but simple toggles work well too */}
            <button 
              onClick={() => setActiveTab('books')}
              className={`flex-1 py-2 sm:py-2.5 rounded-[16px] text-[13px] sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.96] min-w-[30%] ${activeTab === 'books' ? 'bg-surface shadow-[0_2px_12px_max(rgba(0,0,0,0.1),var(--color-shadow,transparent))] text-primary border border-outline-variant/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 border border-transparent'}`}
            >
              <Library size={16} className={`transition-transform duration-300 ${activeTab === 'books' ? 'scale-110' : 'scale-100'}`} />
              <span>Tất cả</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 sm:py-2.5 rounded-[16px] text-[13px] sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.96] min-w-[30%] ${activeTab === 'history' ? 'bg-surface shadow-[0_2px_12px_max(rgba(0,0,0,0.1),var(--color-shadow,transparent))] text-primary border border-outline-variant/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 border border-transparent'}`}
            >
              <Clock size={16} className={`transition-transform duration-300 ${activeTab === 'history' ? 'scale-110' : 'scale-100'}`} />
              <span>Lịch sử</span>
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 sm:py-2.5 rounded-[16px] text-[13px] sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.96] min-w-[30%] ${activeTab === 'ai' ? 'bg-surface shadow-[0_2px_12px_max(rgba(0,0,0,0.1),var(--color-shadow,transparent))] text-primary border border-outline-variant/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 border border-transparent'}`}
            >
              <Sparkles size={16} className={`transition-transform duration-300 ${activeTab === 'ai' ? 'text-primary scale-110' : 'scale-100'}`} />
              <span>Dịch AI</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4 pb-6">
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
              
              {currentPagination.totalPages > 1 && (
                <div className="flex items-center gap-2 mt-6">
                  <button 
                    onClick={() => handlePageChange(currentPagination.currentPage - 1)}
                    disabled={isLoading || currentPagination.currentPage === 1}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Trang trước
                  </button>
                  <button 
                    onClick={() => handlePageChange(currentPagination.currentPage + 1)}
                    disabled={isLoading || currentPagination.currentPage >= currentPagination.totalPages}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Trang sau'}
                  </button>
                </div>
              )}
            </div>
          ) : displayedBooks.map((book) => {
            const isRead = book.totalTranslated > 0;
            const progress = book.chapterCount > 0 ? (book.totalTranslated / book.chapterCount) * 100 : 0;
            
            return (
            <article 
              key={book.bookId}
              onClick={() => book?.lastReadChapter && activeTab === 'history' ? onNavigate({ type: 'reader', bookId: book.bookId, chapterId: book.lastReadChapter.chapterId, rootTab: activeTab }) : onNavigate({ type: 'book', bookId: book.bookId, filterState: activeTab === 'ai' ? 'PENDING' : 'all', rootTab: activeTab })}
              className={`group relative flex flex-col gap-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md hover:border-primary/40 ${!isRead && activeTab === 'books' ? 'opacity-80' : ''}`}
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[15px] sm:text-base font-bold text-on-surface leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {book.bookName}
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-on-surface-variant/80">
                  <Clock size={10} />
                  <span>Cập nhật: {book.updatedAt ? book.updatedAt : book.createdAt ? book.createdAt : 'N/A'}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                {activeTab !== 'history' ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-variant/50 text-on-surface-variant text-[10px] sm:text-xs font-medium border border-outline-variant/20">
                      <BookOpen size={10} className="sm:w-3 sm:h-3 opacity-70" />
                      Tổng: {book.chapterCount}
                    </span>
                    
                    {book.totalTranslated > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold border border-primary/20">
                        Đã dịch: {book.totalTranslated}
                      </span>
                    )}
                    
                    {book.totalPending > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-warning/10 text-warning text-[10px] sm:text-xs font-semibold border border-warning/20">
                        Chờ dịch: {book.totalPending}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold border border-primary/20 w-fit max-w-full">
                    <History size={12} className="shrink-0" />
                    <span className="truncate">C.{book.lastReadChapter?.chapterNumber} {book.lastReadChapter?.title ? `- ${book.lastReadChapter.title}` : ''}</span>
                  </span>
                )}
              </div>
            </article>
          )})}
          
          {displayedBooks.length > 0 && activeTab !== 'history' && currentPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 pb-8 border-t border-outline-variant/20 mt-4">
              <button 
                onClick={() => handlePageChange(currentPagination.currentPage - 1)}
                disabled={isLoading || currentPagination.currentPage <= 1}
                className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant/50 hover:bg-surface-container-high text-on-surface rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm bg-surface-container-low"
              >
                Trang trước
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-on-surface">
                  Trang {currentPagination.currentPage} / {currentPagination.totalPages}
                </span>
              </div>
              
              <button 
                onClick={() => handlePageChange(currentPagination.currentPage + 1)}
                disabled={isLoading || currentPagination.currentPage >= currentPagination.totalPages}
                className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant/50 hover:bg-surface-container-high text-on-surface rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm bg-surface-container-low"
              >
                Trang sau
              </button>
            </div>
          )}
        </section>
      </main>

      {showGlobalSettings && (
        <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} />
      )}

      <LoadingOverlay isLoading={isLoading} message="Đang tải danh sách truyện..." />
    </>
  );
}
