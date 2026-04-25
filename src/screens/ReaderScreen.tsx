import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, List, ChevronLeft, ChevronRight, Type, Languages, Edit3, X, Home } from 'lucide-react';
import { AppView } from '../App';
import { api, ChapterContent, Chapter } from '../lib/api';
import { SettingsSheet } from '../components/SettingsSheet';
import { TranslationSheet } from '../components/TranslationSheet';
import { EditWordSheet } from '../components/EditWordSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useReaderSettings } from '../contexts/ReaderContext';
import { cn } from '../lib/utils';

export function ReaderScreen({ bookId, chapterId, onNavigate }: { bookId: string, chapterId: string, onNavigate: (v: AppView) => void }) {
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [bookChapters, setBookChapters] = useState<Chapter[]>([]);
  const [drawerPage, setDrawerPage] = useState(1);
  const [hasMoreChapters, setHasMoreChapters] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showEditWord, setShowEditWord] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedText, setSelectedText] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const { theme, font, fontSize, lineHeight, groupLines, isEnabledReplace } = useReaderSettings();
  
  const contentRef = useRef<HTMLDivElement>(null);

  // Keep track of the last loaded chapter to avoid scrolling to top on toggle
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingContent(true);
    api.getChapterContent(chapterId, groupLines, isEnabledReplace).then(res => {
      setContent(res);
      setIsLoadingContent(false);
      
      if (lastChapterId !== chapterId) {
        window.scrollTo(0, 0);
        setLastChapterId(chapterId);
      }
    }).catch(() => {
      setIsLoadingContent(false);
    });
  }, [chapterId, groupLines, isEnabledReplace]);

  const loadMoreChapters = async (pageToLoad: number) => {
    if (isLoadingChapters || !hasMoreChapters) return;
    setIsLoadingChapters(true);
    try {
      const res = await api.getChapters(bookId, pageToLoad, 50, 'chapterNumber', 'ASC');
      setBookChapters(prev => {
        const newChapters = res.chapters.filter(c => !prev.some(p => p.chapterId === c.chapterId));
        return [...prev, ...newChapters];
      });
      if (res.chapters.length < 50 || pageToLoad >= res.pagination.totalPages) {
        setHasMoreChapters(false);
      }
      setDrawerPage(pageToLoad + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  useEffect(() => {
    const handleSelection = () => {
      // Delay slightly to ensure selection is registered
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          setSelectedText(selection.toString().trim());
          setShowControls(true); // Auto show controls when text is selected
        } else {
          setSelectedText('');
        }
      }, 50);
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, []);

  // Click outside to toggle controls
  const handleContentClick = () => {
    if (window.getSelection()?.toString().trim()) {
      return; // Do not hide controls if text is selected
    }
    setShowControls(!showControls);
  };

  // Calculate dynamic styles based on settings
  const containerStyle = {
    fontFamily: font === 'palatino' ? '"Palatino Linotype", "Book Antiqua", Palatino, serif' : 
                font === 'bookerly' ? 'Bookerly, serif' : 
                font === 'minhphung' ? '"Minh Phung", sans-serif' : 'var(--font-sans)',
  };

  useEffect(() => {
    // Colors are now handled globally via CSS variables and data-theme
  }, []);

  if (!content) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">Đang tải nội dung...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col antialiased relative transition-colors duration-300" style={containerStyle}>
      
      {/* Top Header Overlay */}
      <header 
        aria-hidden="true"
        className={cn(
          "fixed top-0 left-0 w-full z-40 backdrop-blur-[16px] border-b transition-transform duration-300 translate-y-0 text-inherit",
          "bg-background/90 border-outline-variant/50"
        )}
      >
        <div className="max-w-reading-max-width mx-auto w-full px-4 sm:px-8 py-2 sm:py-4 flex justify-between items-center h-16">
          <div className="flex items-center gap-1 -ml-4 sm:-ml-2">
            <button onClick={() => onNavigate({ type: 'book', bookId })} className="hover:opacity-70 transition-opacity p-2 rounded-full" title="Về chi tiết truyện">
              <ArrowLeft size={24} />
            </button>
            <button onClick={() => onNavigate({ type: 'library' })} className="hover:opacity-70 transition-opacity p-2 rounded-full" title="Về trang chủ">
              <Home size={22} />
            </button>
          </div>
          <div className="flex-1 text-center truncate px-2 opacity-90">
            <h4 className="font-sans font-semibold truncate">{content.chapter.bookName}</h4>
            <p className="opacity-80 truncate">Chương {content.chapter.chapterNumber}</p>
          </div>
          <div className="flex items-center gap-1 -mr-2">
            <button onClick={() => { setShowTranslation(true); setShowControls(false); }} className="hover:opacity-70 transition-opacity p-2 rounded-full hidden sm:block">
              <Languages size={20} />
            </button>
            <button onClick={() => { setShowEditWord(true); setShowControls(false); }} className="hover:opacity-70 transition-opacity p-2 rounded-full hidden sm:block">
              <Edit3 size={20} />
            </button>
            <button onClick={() => { setShowSettings(true); setShowControls(false); }} className="hover:opacity-70 transition-opacity p-2 rounded-full hidden sm:block">
              <Type size={20} />
            </button>
            <button onClick={() => { 
              setShowChapterDrawer(true); 
              setShowControls(false); 
              if (bookChapters.length === 0) {
                loadMoreChapters(1);
              }
            }} className="hover:opacity-70 transition-opacity p-2 rounded-full">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>



      {/* Chapter Drawer */}
      <div aria-hidden="true" className={cn(
        "fixed inset-0 z-[100] flex justify-end transition-opacity duration-300",
        showChapterDrawer ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setShowChapterDrawer(false)} />
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
            {bookChapters.length === 0 && isLoadingChapters ? (
              <div className="flex justify-center items-center h-20 text-on-surface-variant text-sm">Đang tải mục lục...</div>
            ) : (
              <>
                {bookChapters.map((chap) => {
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
                })}
                {hasMoreChapters && (
                   <button 
                     onClick={() => loadMoreChapters(drawerPage)}
                     disabled={isLoadingChapters}
                     className="w-full text-center py-3 text-sm text-primary hover:bg-surface-container-high rounded-xl mt-2"
                   >
                     {isLoadingChapters ? 'Đang tải...' : 'Tải thêm'}
                   </button>
                )}
              </>
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
        className="flex-1 w-full max-w-reading-max-width mx-auto px-6 sm:px-12 lg:px-20 pt-24 pb-16 cursor-pointer"
        onClick={handleContentClick}
        ref={contentRef}
      >
        <article 
          className="max-w-none will-change-contents"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            textAlign: 'justify',
            color: 'inherit'
          }}
        >
          <h4 className="font-headline-md text-primary mt-2 mb-4 text-center font-bold" style={{ fontSize: `${Math.round(fontSize * 1.2)}px`, lineHeight: 1.35 }}>
            Chương {content.chapter.chapterNumber}: {content.chapter.title}
          </h4>
          
          {content.chapter.content.map((paragraph, index) => (
            <div key={index} className="mb-4" dangerouslySetInnerHTML={{ __html: paragraph }} />
          ))}
          
          <div className="w-16 h-[2px] bg-outline-variant/30 mt-8 mx-auto rounded-full"></div>
        </article>
      </main>

      <div aria-hidden="true">
        {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
        {showTranslation && <TranslationSheet onClose={() => setShowTranslation(false)} currentBookName={content.chapter.bookName} currentChapterName={`Chương ${content.chapter.chapterNumber}: ${content.chapter.title}`} currentBookId={bookId} />}
        {showEditWord && <EditWordSheet onClose={() => setShowEditWord(false)} initialMatch={selectedText} currentBookId={bookId} currentChapterId={chapterId} />}
      </div>

      {/* Bottom Controls Overlay */}
      <nav 
        aria-hidden="true"
        className={cn(
          "fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.1)] border-t pb-safe-bottom text-inherit",
          showControls ? "translate-y-0" : "translate-y-full",
          "bg-background/95 border-outline-variant/50"
        )}
      >
        <div className="flex justify-between sm:justify-center gap-1 sm:gap-6 px-4 py-1.5 sm:py-2 items-center opacity-90 max-w-reading-max-width mx-auto">
          <button 
            disabled={!content.navigation?.prev?.chapterId}
            onClick={() => content.navigation?.prev?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.prev.chapterId })}
            className="flex flex-col items-center justify-center hover:opacity-100 opacity-70 active:scale-90 transition-all duration-300 p-1.5 group disabled:opacity-30 flex-1 sm:flex-none rounded-xl"
          >
             <ChevronLeft size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:-translate-x-1 group-active:-translate-x-2 transition-transform duration-300" />
             <span className="text-[10px] font-medium tracking-wide">Trước</span>
          </button>

          <div className="w-[1px] h-5 opacity-20 bg-current hidden sm:block mx-1"></div>

          <button 
            onClick={() => { setShowTranslation(true); setShowControls(false); }}
            className="flex flex-col items-center justify-center hover:opacity-100 opacity-70 active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl relative group"
          >
             <div className="relative mb-1 group-hover:-translate-y-0.5 transition-transform duration-300">
               <Languages size={20} className="sm:w-5 sm:h-5" />
             </div>
             <span className="text-[10px] font-medium tracking-wide">Dịch</span>
          </button>

          <div className="w-[1px] h-5 opacity-20 bg-current hidden sm:block mx-1"></div>

          <button 
            onClick={() => { setShowEditWord(true); setShowControls(false); }}
            className={cn(
              "flex flex-col items-center justify-center active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl relative group",
              selectedText ? "opacity-100 text-primary" : "hover:opacity-100 opacity-70"
            )}
          >
             <div className="relative mb-1 group-hover:-translate-y-0.5 transition-transform duration-300">
               <Edit3 size={20} className="sm:w-5 sm:h-5" />
               {selectedText && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping opacity-75"></span>
               )}
               {selectedText && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-current opacity-50"></span>
               )}
             </div>
             <span className="text-[10px] font-medium tracking-wide">Thay thế</span>
          </button>
          
          <div className="w-[1px] h-5 opacity-20 bg-current hidden sm:block mx-1"></div>

          <button 
             onClick={() => { setShowSettings(true); setShowControls(false); }}
            className="flex flex-col items-center justify-center hover:opacity-100 opacity-70 active:scale-90 transition-all duration-300 p-1.5 flex-1 sm:flex-none rounded-xl group"
          >
             <Type size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:-translate-y-0.5 transition-transform duration-300" />
             <span className="text-[10px] font-medium tracking-wide">Cài đặt</span>
          </button>
          
          <div className="w-[1px] h-5 opacity-20 bg-current hidden sm:block mx-1"></div>

          <button 
            disabled={!content.navigation?.next?.chapterId}
            onClick={() => content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId })}
            className="flex flex-col items-center justify-center hover:opacity-100 opacity-70 active:scale-90 transition-all duration-300 p-1.5 group disabled:opacity-30 flex-1 sm:flex-none rounded-xl"
          >
             <ChevronRight size={20} className="sm:w-5 sm:h-5 mb-1 group-hover:translate-x-1 group-active:translate-x-2 transition-transform duration-300" />
             <span className="text-[10px] font-medium tracking-wide">Sau</span>
          </button>
        </div>
      </nav>
      
      <div aria-hidden="true">
        <LoadingOverlay isLoading={isLoadingContent} message="Đang tải nội dung chương..." />
      </div>
    </div>
  );
}
