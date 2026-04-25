import { useState, useEffect } from 'react';
import { Menu, Search, SortDesc, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import { api, Chapter, Book } from '../lib/api';
import { AppView } from '../App';

export function ChapterListScreen({ bookId, onNavigate }: { bookId: string, onNavigate: (v: AppView) => void }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [filterState, setFilterState] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    // In a real app we'd fetch this specific book's details. For now filter from list.
    api.getBooks().then(res => {
      const b = res.data.find(x => x.bookId === bookId);
      if (b) setBook(b);
    });
    api.getChapters(bookId).then(res => setChapters(res.chapters));
  }, [bookId]);

  return (
    <>
      <header className="bg-background/90 backdrop-blur-xl sticky top-0 w-full z-50 border-b border-surface-variant">
        <div className="flex justify-between items-center w-full px-4 h-14 max-w-reading-max-width mx-auto">
          <button onClick={() => onNavigate({ type: 'library' })} className="text-primary hover:text-primary-fixed transition-colors active:opacity-70 flex items-center p-1 -ml-1">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-primary font-bold tracking-widest uppercase text-xs">Thư Viện Số</h1>
          <button className="text-primary hover:text-primary-fixed transition-colors active:opacity-70 flex items-center p-1 -mr-1">
            <Search size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-reading-max-width mx-auto px-4 py-4 w-full pb-32">
        <div className="mb-6 flex items-start sm:items-end justify-between flex-col sm:flex-row gap-2">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-on-surface mb-1">{book?.bookName || 'Đang tải...'}</h2>
            <p className="text-xs sm:text-sm text-on-surface-variant">Tác giả: {book?.author || 'Đang tải...'}</p>
          </div>
          <span className="bg-surface-variant text-on-surface px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold">Đang ra</span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 w-full sm:w-auto">
            <button 
              onClick={() => setFilterState('all')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all ${filterState === 'all' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Tất cả
            </button>
            <button 
              onClick={() => setFilterState('pending')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all ${filterState === 'pending' ? 'bg-surface-bright text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Chưa dịch
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
              <input 
                type="text" 
                placeholder="Tìm chương..." 
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg py-1.5 pl-9 pr-4 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-on-surface-variant"
              />
            </div>
            <button className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/50 rounded-lg px-3 py-1.5 text-xs text-on-surface hover:bg-surface-variant transition-colors whitespace-nowrap">
              <SortDesc size={16} />
              <span className="hidden sm:inline">Mới nhất</span>
            </button>
          </div>
        </div>

        {filterState === 'pending' && (
          <div className="bg-surface-container-low border border-warning/30 rounded-xl p-3 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-warning mb-0.5">Có {chapters.filter(c => c.state === 'FAILED').length} chương chưa dịch</p>
              <p className="text-[10px] text-on-surface-variant">Chọn dịch nhanh để tự động dịch các chương này</p>
            </div>
            <button className="bg-warning text-warning-on-container px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">
              Dịch nhanh
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {chapters.filter(c => filterState === 'all' || c.state === 'FAILED').map((chapter, index) => {
            // Emulate state logic from mockup
            const isRead = index === 0 && filterState === 'all';
            const isNew = index === 1 && filterState === 'all';
            const isFailed = chapter.state === 'FAILED';
            
            return (
              <a 
                key={chapter.chapterId}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isFailed) onNavigate({ type: 'reader', bookId, chapterId: chapter.chapterId });
                }}
                className={`block rounded-xl p-3 sm:p-4 transition-colors group border 
                  ${isNew ? 'bg-surface-container-high hover:bg-surface-variant border-l-4 border-l-primary shadow-sm relative overflow-hidden' : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 hover:border-outline-variant/80'}
                  ${isFailed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isNew && <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>}
                
                <div className="flex justify-between items-start relative z-10 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm sm:text-base font-medium transition-colors line-clamp-2 ${
                      isNew ? 'text-primary' : 'text-on-surface group-hover:text-primary'
                    }`}>
                      Chương {chapter.chapterNumber}: {chapter.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1">
                      {isRead ? 'Đã đọc • 2 ngày trước' : isNew ? 'Cập nhật hôm qua' : isFailed ? 'Dự kiến: Ngày mai' : 'Cập nhật hôm nay'}
                    </p>
                  </div>
                  
                  {isRead && <CheckCircle2 size={18} className="text-primary fill-primary/20 flex-shrink-0 mt-0.5" />}
                  {isNew && <span className="bg-primary text-on-primary text-[10px] font-bold tracking-wider px-2 py-0.5 rounded flex-shrink-0 mt-0.5">MỚI</span>}
                  {isFailed && <Lock size={16} className="text-on-surface-variant flex-shrink-0 mt-0.5" />}
                </div>
              </a>
            );
          })}
        </div>
      </main>
    </>
  );
}
