import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, List, ChevronLeft, ChevronRight, Type, Languages, Edit3, X } from 'lucide-react';
import { AppView } from '../App';
import { api, ChapterContent, Chapter } from '../lib/api';
import { SettingsSheet } from '../components/SettingsSheet';
import { TranslationSheet } from '../components/TranslationSheet';
import { EditWordSheet } from '../components/EditWordSheet';
import { useReaderSettings } from '../contexts/ReaderContext';
import { cn } from '../lib/utils';

export function ReaderScreen({ bookId, chapterId, onNavigate }: { bookId: string, chapterId: string, onNavigate: (v: AppView) => void }) {
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [bookChapters, setBookChapters] = useState<Chapter[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showEditWord, setShowEditWord] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [readProgress, setReadProgress] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const { theme, font, fontSize, lineHeight, textAlign } = useReaderSettings();
  
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChapterContent(chapterId).then(res => setContent(res));
  }, [chapterId]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const innerHeight = window.innerHeight;
      
      if (scrollHeight > innerHeight) {
        const progress = (scrollY / (scrollHeight - innerHeight)) * 100;
        setReadProgress(progress);
      } else {
        setReadProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        setSelectedText(selection.toString().trim());
        setShowControls(true); // Auto show controls when text is selected
      } else {
        setSelectedText('');
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  // Click outside to toggle controls
  const handleContentClick = () => {
    if (window.getSelection()?.toString().trim()) {
      return; // Do not hide controls if text is selected
    }
    setShowControls(!showControls);
  };

  if (!content) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">Đang tải nội dung...</div>;
  }

  // Calculate dynamic styles based on settings
  const containerStyle = {
    backgroundColor: theme === 'light' ? '#ffffff' : theme === 'paper' ? '#f4ecd8' : theme === 'dark' ? '#121212' : '#050505',
    color: theme === 'light' ? '#111827' : theme === 'paper' ? '#5c4d3c' : theme === 'dark' ? '#e0e0e0' : '#d4d4d4',
    fontFamily: font === 'palatino' ? '"Palatino Linotype", "Book Antiqua", Palatino, serif' : 
                font === 'bookerly' ? 'Bookerly, serif' : 
                font === 'minhphung' ? '"Minh Phung", sans-serif' : 'var(--font-sans)',
  };

  return (
    <div className="min-h-screen flex flex-col antialiased relative transition-colors duration-300" style={containerStyle}>
      
      {/* Top Header Overlay */}
      <header className={cn(
        "fixed top-0 left-0 w-full z-40 bg-[var(--color-glass)] backdrop-blur-[16px] border-b border-surface-variant transition-transform duration-300 translate-y-0 text-on-surface"
      )}>
        <div className="max-w-reading-max-width mx-auto w-full px-4 sm:px-8 py-2 sm:py-4 flex justify-between items-center h-16">
          <button onClick={() => onNavigate({ type: 'book', bookId })} className="text-on-surface hover:text-primary transition-colors p-2 -ml-2 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 text-center truncate px-4">
            <h1 className="font-sans text-sm font-semibold truncate">{content.chapter.bookName}</h1>
            <p className="text-[10px] text-on-surface-variant truncate">Chương {content.chapter.chapterNumber}: {content.chapter.title}</p>
          </div>
          <div className="flex items-center gap-1 -mr-2">
            <button onClick={() => { setShowTranslation(true); setShowControls(false); }} className="text-on-surface hover:text-primary transition-colors p-2 rounded-full hidden sm:block">
              <Languages size={20} />
            </button>
            <button onClick={() => { setShowEditWord(true); setShowControls(false); }} className="text-on-surface hover:text-primary transition-colors p-2 rounded-full hidden sm:block">
              <Edit3 size={20} />
            </button>
            <button onClick={() => { setShowSettings(true); setShowControls(false); }} className="text-on-surface hover:text-primary transition-colors p-2 rounded-full hidden sm:block">
              <Type size={20} />
            </button>
            <button onClick={() => { 
              setShowChapterDrawer(true); 
              setShowControls(false); 
              if (bookChapters.length === 0) {
                api.getChapters(bookId).then(res => setBookChapters(res.chapters));
              }
            }} className="text-on-surface hover:text-primary transition-colors p-2 rounded-full">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Progress Bar (always visible) */}
      <div className="fixed top-0 left-0 w-full h-[3px] z-50 bg-transparent">
        <div 
          className="h-full bg-primary transition-all duration-100 ease-out" 
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Chapter Drawer */}
      <div className={cn(
        "fixed inset-0 z-[100] flex justify-end transition-opacity duration-300",
        showChapterDrawer ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowChapterDrawer(false)} />
        <div className={cn(
          "w-[85%] max-w-sm bg-surface-container h-full relative flex flex-col shadow-2xl transition-transform duration-300",
          showChapterDrawer ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="p-4 border-b border-surface-variant flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">Mục lục</h2>
            <button onClick={() => setShowChapterDrawer(false)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
            {bookChapters.length === 0 ? (
              <div className="flex justify-center items-center h-20 text-on-surface-variant text-sm">Đang tải mục lục...</div>
            ) : (
              bookChapters.map((chap) => {
                const isActive = chap.chapterId === chapterId;
                return (
                  <button
                    key={chap.chapterId}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors border ${isActive ? 'bg-primary/10 border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:bg-surface-container-high'}`}
                    onClick={() => {
                      setShowChapterDrawer(false);
                      onNavigate({ type: 'reader', bookId, chapterId: chap.chapterId });
                    }}
                  >
                    Chương {chap.chapterNumber}: {chap.title}
                  </button>
                );
              })
            )}
          </div>
          <div className="p-4 border-t border-surface-variant bg-surface pb-safe-bottom">
            <button
               onClick={() => { setShowChapterDrawer(false); onNavigate({ type: 'book', bookId }); }}
               className="w-full py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-variant transition-colors text-sm font-semibold"
            >
              Xem chi tiết truyện
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="flex-1 w-full max-w-reading-max-width mx-auto px-8 sm:px-12 lg:px-20 pt-24 pb-32 cursor-pointer"
        onClick={handleContentClick}
        ref={contentRef}
      >
        <article 
          className="max-w-none space-y-6 will-change-contents"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            textAlign: textAlign,
            color: 'inherit'
          }}
        >
          <h2 className="font-headline-md text-primary mt-4 mb-8 text-center" style={{ fontSize: `${fontSize * 1.3}px`, lineHeight: 1.3 }}>
            Chương {content.chapter.chapterNumber}: {content.chapter.title}
          </h2>
          
          {content.chapter.content.map((paragraph, index) => (
            <div key={index} className="mb-4" dangerouslySetInnerHTML={{ __html: paragraph }} />
          ))}
          
          <div className="w-16 h-[2px] bg-outline-variant/30 my-16 mx-auto rounded-full"></div>
        </article>
      </main>

      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
      {showTranslation && <TranslationSheet onClose={() => setShowTranslation(false)} currentBookName={content.chapter.bookName} currentChapterName={`Chương ${content.chapter.chapterNumber}: ${content.chapter.title}`} currentBookId={bookId} />}
      {showEditWord && <EditWordSheet onClose={() => setShowEditWord(false)} initialMatch={selectedText} currentBookId={bookId} currentChapterId={chapterId} />}

      {/* Bottom Controls Overlay */}
      <nav className={cn(
        "fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 pointer-events-none pb-safe-bottom",
        showControls ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="flex justify-between sm:justify-center gap-1 sm:gap-6 px-4 py-1.5 sm:py-2 items-center bg-[#18181b]/90 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] border-t border-white/10 pointer-events-auto">
          <button 
            disabled={!content.navigation?.prev?.chapterId}
            onClick={() => content.navigation?.prev?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.prev.chapterId })}
            className="flex flex-col items-center justify-center text-on-surface-variant/80 hover:text-on-surface active:scale-90 transition-all duration-300 p-1.5 group disabled:opacity-30 disabled:active:scale-100 disabled:hover:text-on-surface-variant flex-1 sm:flex-none rounded-xl hover:bg-white/5"
          >
             <ChevronLeft size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:-translate-x-1 group-active:-translate-x-2 transition-transform duration-300 text-on-surface" />
             <span className="text-[10px] font-medium tracking-wide">Trước</span>
          </button>

          <div className="w-[1px] h-5 bg-white/10 hidden sm:block mx-1"></div>

          <button 
            onClick={() => { setShowTranslation(true); setShowControls(false); }}
            className="flex flex-col items-center justify-center text-on-surface-variant/80 hover:text-on-surface active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl hover:bg-white/5 relative group"
          >
             <div className="relative mb-1 group-hover:-translate-y-0.5 transition-transform duration-300">
               <Languages size={20} className="sm:w-5 sm:h-5 text-on-surface" />
             </div>
             <span className="text-[10px] font-medium tracking-wide">Dịch</span>
          </button>

          <div className="w-[1px] h-5 bg-white/10 hidden sm:block mx-1"></div>

          <button 
            onClick={() => { setShowEditWord(true); setShowControls(false); }}
            className={cn(
              "flex flex-col items-center justify-center active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl relative group",
              selectedText ? "text-primary hover:bg-primary/10" : "text-on-surface-variant/80 hover:text-on-surface hover:bg-white/5"
            )}
          >
             <div className="relative mb-1 group-hover:-translate-y-0.5 transition-transform duration-300">
               <Edit3 size={20} className={cn("sm:w-5 sm:h-5", selectedText ? "text-primary" : "text-on-surface")} />
               {selectedText && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping opacity-75"></span>
               )}
               {selectedText && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-[#18181b]"></span>
               )}
             </div>
             <span className={cn("text-[10px] font-medium tracking-wide", selectedText && "text-primary/90")}>Thay thế</span>
          </button>
          
          <div className="w-[1px] h-5 bg-white/10 hidden sm:block mx-1"></div>

          <button 
             onClick={() => { setShowSettings(true); setShowControls(false); }}
            className="flex flex-col items-center justify-center text-on-surface-variant/80 hover:text-on-surface active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl hover:bg-white/5 group"
          >
             <Type size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:-translate-y-0.5 transition-transform duration-300 text-on-surface" />
             <span className="text-[10px] font-medium tracking-wide">Cài đặt</span>
          </button>
          
          <div className="w-[1px] h-5 bg-white/10 hidden sm:block mx-1"></div>

          <button 
            disabled={!content.navigation?.next?.chapterId}
            onClick={() => content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId })}
            className="flex flex-col items-center justify-center text-on-surface-variant/80 hover:text-on-surface active:scale-90 transition-all duration-300 p-1.5 group disabled:opacity-30 disabled:active:scale-100 disabled:hover:text-on-surface-variant flex-1 sm:flex-none rounded-xl hover:bg-white/5"
          >
             <ChevronRight size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:translate-x-1 group-active:translate-x-2 transition-transform duration-300 text-on-surface" />
             <span className="text-[10px] font-medium tracking-wide">Sau</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
