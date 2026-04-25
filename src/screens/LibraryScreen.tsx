import { useState, useEffect } from 'react';
import { User, Search, MoreVertical, BookOpen, Settings, History, Sparkles } from 'lucide-react';
import { api, Book } from '../lib/api';
import { AppView } from '../App';

export function LibraryScreen({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'books' | 'history'>('books');

  useEffect(() => {
    api.getBooks().then(res => setBooks(res.data));
  }, []);

  const displayedBooks = activeTab === 'books' 
    ? books 
    : books.filter(b => b.totalTranslated > 0);

  return (
    <>
      <header className="bg-background/90 backdrop-blur-md sticky top-0 z-40 border-b border-surface-variant flex justify-between items-center w-full px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-container overflow-hidden flex items-center justify-center">
            <User size={18} className="text-on-surface" />
          </div>
          <h1 className="font-serif text-primary text-xl tracking-tight font-bold">Thư Viện</h1>
        </div>
        <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full">
          <Search size={20} />
        </button>
      </header>

      <main className="flex-grow w-full max-w-reading-max-width mx-auto px-4 py-4 flex flex-col gap-4 pb-6">
        <div className="flex gap-6 border-b border-surface-container pb-2 mb-2">
          <button 
            onClick={() => setActiveTab('books')}
            className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === 'books' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Danh sách truyện
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Lịch sử xem
          </button>
        </div>

        <section className="flex flex-col gap-3">
          {displayedBooks.length === 0 ? (
            <div className="text-center text-sm text-on-surface-variant py-8">Không có dữ liệu.</div>
          ) : displayedBooks.map((book) => {
            const isRead = book.totalTranslated > 0;
            const progress = book.chapterCount > 0 ? (book.totalTranslated / book.chapterCount) * 100 : 0;
            
            return (
            <article 
              key={book.bookId}
              onClick={() => onNavigate({ type: 'book', bookId: book.bookId })}
              className={`flex items-center gap-3 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/30 hover:border-outline-variant/80 transition-colors cursor-pointer ${!isRead && activeTab === 'books' ? 'opacity-70' : ''}`}
            >
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-surface-container flex-shrink-0 relative border border-outline-variant/30">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-variant flex items-center justify-center text-[9px] text-center p-1 text-on-surface-variant font-serif italic uppercase">No Cover</div>
                )}
                <div className="absolute inset-0 bg-black/20"></div>
              </div>
              <div className="flex-grow flex flex-col justify-center min-w-0 py-1">
                <p className="text-[10px] text-primary uppercase font-semibold tracking-[0.05em] mb-1">{book.source || 'THUVIEN.SO'}</p>
                <h2 className="text-base font-bold text-on-surface truncate mb-1">{book.bookName}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
                  Chương {book.totalTranslated} - {book.author ? book.author : 'Mới cập nhật'}
                </p>
                <div className="w-full bg-surface-container-high h-1 mt-2.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              <button className="text-on-surface-variant hover:text-primary p-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical size={18} />
              </button>
            </article>
          )})}
        </section>
      </main>

    </>
  );
}
