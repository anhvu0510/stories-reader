import { useState, useEffect, useRef } from 'react';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles, Library, X, Clock, Loader2, Save } from 'lucide-react';
import { api, Book } from '../lib/api';
import { AppView } from '../App';
import { LoadingOverlay } from '../components/LoadingOverlay';

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
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiDomainInput, setApiDomainInput] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadBooks = async (pageNum: number, searchKeyword: string, currentTab: string) => {
    setIsLoading(true);
    try {
      if (currentTab === 'ai') {
        const res = await api.getBooks(pageNum, searchKeyword, 'PENDING', 20);
        setAiBooks(res.data);
        if (res.pagination) {
          const totalPages = Number(res.pagination.totalPages) || 1;
          setAiPagination({ currentPage: pageNum, totalPages });
          setHasMore(pageNum < totalPages);
        }
      } else {
        const res = await api.getBooks(pageNum, searchKeyword, undefined, 20);
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
      <header className="bg-background/90 backdrop-blur-md sticky top-0 z-40 border-b border-surface-variant flex flex-col w-full pb-2 shadow-sm pt-2">
        {/* Header Tabs */}
        <div className="px-4 mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center bg-surface-container p-1 rounded-xl w-full mx-auto max-w-full overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setActiveTab('books')}
              className={`flex-1 sm:px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[33%] ${activeTab === 'books' ? 'bg-background text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            >
              <Library size={14} />
              <span>Tất cả</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[33%] ${activeTab === 'history' ? 'bg-background text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            >
              <Clock size={14} />
              <span>Lịch sử</span>
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex-1 sm:px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[33%] ${activeTab === 'ai' ? 'bg-primary/10 text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            >
              <Sparkles size={14} className={activeTab === 'ai' ? 'text-primary' : ''} />
              <span>Dịch AI</span>
            </button>
          </div>
          <button 
            onClick={() => {
              const currentDomain = localStorage.getItem('API_DOMAIN_CONFIG') || '';
              setApiDomainInput(currentDomain);
              setShowSettingsModal(true);
            }}
            className="p-2 sm:px-4 sm:py-2.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors flex-shrink-0 flex items-center justify-center shadow-sm border border-transparent hover:border-primary/20"
            title="Cài đặt API Domain"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-grow w-full mx-auto px-4 py-4 flex flex-col gap-4 pb-6">
        {/* Search Bar */}
        <div className="relative mb-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 bg-surface-container border-transparent rounded-2xl text-on-surface focus:bg-surface-container-high focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm outline-none placeholder:text-on-surface-variant/60 shadow-sm"
            placeholder="Tìm kiếm truyện, tác giả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
            >
              <X size={18} />
            </button>
          )}
        </div>

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
              onClick={() => onNavigate({ type: 'book', bookId: book.bookId, filterState: activeTab === 'ai' ? 'PENDING' : 'all' })}
              className={`relative overflow-hidden bg-surface-container p-3.5 sm:p-4 rounded-xl border border-outline-variant/60 shadow-sm hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.98] group ${!isRead && activeTab === 'books' ? 'opacity-80' : ''}`}
            >
              {/* Subtle background color tint */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30 group-hover:bg-primary transition-colors" />
              
              <div className="flex gap-3 relative z-10 pl-1">
                <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                  <h2 className="text-[15px] sm:text-base font-bold text-on-surface leading-tight mb-2.5 break-words text-wrap group-hover:text-primary transition-colors">
                    {book.bookName}
                  </h2>
                  
                  <div className="mt-auto flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                    <div className="flex items-center gap-1 border border-outline-variant/50 bg-surface-container-high px-2 py-1 rounded-md">
                      <span className="opacity-70 text-on-surface-variant">Tổng:</span>
                      <span className="font-semibold text-on-surface">{book.chapterCount}</span>
                    </div>
                    <div className="flex items-center gap-1 border border-primary/30 bg-primary/10 px-2 py-1 rounded-md text-primary">
                      <span className="opacity-90">Đã dịch:</span>
                      <span className="font-bold">{book.totalTranslated}</span>
                    </div>
                    <div className="flex items-center gap-1 border border-warning/40 bg-warning/10 px-2 py-1 rounded-md text-warning">
                      <span className="opacity-90">Chờ dịch:</span>
                      <span className="font-bold">{book.totalPending}</span>
                    </div>
                    <div className="flex items-center gap-1 border border-outline-variant/50 bg-surface-container-high px-2 py-1 rounded-md">
                      <span className="opacity-70 text-on-surface-variant">Cập nhật:</span>
                      <span className="font-semibold text-on-surface">{book.updatedAt ? book.updatedAt : book.createdAt ? book.createdAt : 'N/A'}</span>
                    </div>
                  </div>
                </div>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-xl border border-outline-variant/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant/30 bg-surface-container-low">
              <h3 className="font-bold text-on-surface">Cấu hình API</h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1.5 ml-1">
                  API Domain
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={apiDomainInput}
                    onChange={(e) => setApiDomainInput(e.target.value)}
                    placeholder="vd: https://api.my-domain.com"
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <p className="text-xs text-on-surface-variant/70 mt-2 ml-1">
                  Nhập URL cơ sở của API backend (bao gồm cả http/https). Để trống nếu muốn chạy ở local fallback.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex justify-end gap-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-on-surface border border-outline-variant/50 hover:bg-surface-container-low transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('API_DOMAIN_CONFIG', apiDomainInput.trim());
                  setShowSettingsModal(false);
                  window.location.reload();
                }}
                className="px-5 py-2.5 rounded-xl font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm text-sm"
              >
                <Save size={16} />
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingOverlay isLoading={isLoading} message="Đang tải danh sách truyện..." />
    </>
  );
}
