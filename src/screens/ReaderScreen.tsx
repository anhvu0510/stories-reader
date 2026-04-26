import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { ArrowLeft, Menu, List, ChevronLeft, ChevronRight, Type, Languages, Edit3, X, Home, Lock, AlertCircle } from 'lucide-react';
import { AppView } from '../App';
import { api, ChapterContent, Chapter } from '../lib/api';
import { SettingsSheet } from '../components/SettingsSheet';
import { TranslationSheet } from '../components/TranslationSheet';
import { EditWordSheet } from '../components/EditWordSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useReaderSettings } from '../contexts/ReaderContext';
import { cn } from '../lib/utils';

const ContentRenderer = memo(({ paragraphs }: { paragraphs: string[] }) => {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <div key={index} lang="vi" className="mb-4" dangerouslySetInnerHTML={{ __html: paragraph }} />
      ))}
    </>
  );
});

export function ReaderScreen({ bookId, chapterId, rootTab , onNavigate }: { bookId: string, chapterId: string, rootTab: string,  onNavigate: (v: AppView) => void }) {
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

  const fetchChapter = () => {
    setIsLoadingContent(true);
    api.getChapterContent(chapterId, groupLines, isEnabledReplace, rootTab).then(res => {
      setContent(res);
      setIsLoadingContent(false);
      
      if (lastChapterId !== chapterId) {
        window.scrollTo(0, 0);
        setLastChapterId(chapterId);
      }
    }).catch(() => {
      setIsLoadingContent(false);
    });
  };

  useEffect(() => {
    fetchChapter();
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
  const containerStyle = useMemo(() => ({
    fontFamily: font === 'palatino' ? '"Palatino Linotype", "Book Antiqua", Palatino, serif' : 
                font === 'bookerly' ? 'Bookerly, serif' : 
                font === 'font_viet_tay' ? '"Patrick Hand", cursive' : 'var(--font-sans)',
  }), [font]);

  const articleStyle = useMemo(() => ({
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    textAlign: 'justify' as const,
    color: 'inherit'
  }), [fontSize, lineHeight]);

  const titleStyle = useMemo(() => ({ 
    fontSize: `14px`, 
    lineHeight: 1.35 
  }), [fontSize]);

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
        aria-hidden={!showControls}
        className={cn(
          "fixed top-0 left-0 w-full z-40 transition-transform duration-500 will-change-transform ease-out", "translate-y-0" ,
          "text-on-surface"
        )}
      >
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-[32px] saturate-150 border-b border-outline-variant/20 shadow-[0_4px_32px_max(rgba(0,0,0,0.1),var(--color-shadow,transparent))]"></div>
        <div className="relative z-10 max-w-reading-max-width mx-auto w-full px-2 sm:px-4 py-1.5 flex justify-between items-center h-14 sm:h-16 pt-[max(env(safe-area-inset-top),6px)]">
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => onNavigate({ type: 'book', bookId, rootTab })} 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 active:scale-95 transition-all text-primary" 
              title="Về chi tiết truyện"
            >
              <ArrowLeft size={22} />
            </button>
            <button 
              onClick={() => onNavigate({ type: 'library' })} 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 active:scale-95 transition-all text-primary md:hidden ml-0.5" 
              title="Về trang chủ"
            >
              <Home size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 sm:px-4">
            <h1 className="font-sans font-bold truncate text-[10px] sm:text-[16px] max-w-[200px] sm:max-w-md w-full text-center leading-tight">
              {content.chapter.bookName}
            </h1>
            <div className="flex items-center mt-1">
              <span className="text-[6px] sm:text-[10px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 sm:px-2.5 py-0.5 rounded-[6px] tracking-widest uppercase shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
                Chương {content.chapter.chapterNumber}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-end shrink-0">
            <button onClick={() => { setShowTranslation(true); setShowControls(false); }} className="w-10 h-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors hidden sm:flex text-primary">
              <Languages size={20} />
            </button>
            <button onClick={() => { setShowEditWord(true); setShowControls(false); }} className="w-10 h-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors hidden sm:flex text-primary">
              <Edit3 size={20} />
            </button>
            <button onClick={() => { setShowSettings(true); setShowControls(false); }} className="w-10 h-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors hidden sm:flex text-primary">
              <Type size={20} />
            </button>
            <button onClick={() => { 
              setShowChapterDrawer(true); 
              setShowControls(false); 
              if (bookChapters.length === 0) {
                loadMoreChapters(1);
              }
            }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 active:scale-95 transition-all text-primary">
              <Menu size={22} />
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
                <div className="flex flex-col gap-1.5 pb-4">
                  {bookChapters.map((chap) => {
                    const isActive = chap.chapterId === chapterId;
                    const isPending = chap.state === 'PENDING';
                    const isFailed = chap.state === 'FAILED';
                    const isSucceeded = chap.state === 'SUCCEEDED';

                    return (
                      <button
                        key={chap.chapterId}
                        disabled={!isSucceeded && !isPending}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all border ${
                          isActive 
                            ? 'bg-primary/10 border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.1)] ring-1 ring-primary/20' 
                            : isSucceeded 
                              ? 'bg-surface border-transparent hover:bg-surface-container-high active:scale-[0.98]' 
                              : isPending
                                ? 'bg-surface border-transparent opacity-80 hover:bg-surface-container-high active:scale-[0.98]'
                                : 'bg-surface-container-lowest border-transparent opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (isSucceeded || isPending) {
                            setShowChapterDrawer(false);
                            onNavigate({ type: 'reader', bookId, chapterId: chap.chapterId, rootTab });
                          }
                        }}
                      >
                        <div className={`mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full border ${
                          isActive ? 'bg-primary text-on-primary border-primary' :
                          isSucceeded ? 'bg-surface-container-high text-on-surface-variant border-outline-variant/30' :
                          isPending ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-error/10 text-error border-error/20'
                        }`}>
                          {isActive ? <div className="w-1.5 h-1.5 rounded-full bg-current" /> :
                           isSucceeded ? <span className="text-[10px] font-bold">{chap.chapterNumber}</span> :
                           isPending ? <Lock size={12} /> :
                           <AlertCircle size={12} />}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`text-[13px] sm:text-[14px] leading-tight line-clamp-2 ${
                            isActive ? 'text-primary font-bold' : 
                            isSucceeded ? 'text-on-surface font-medium' :
                            'text-on-surface-variant'
                          }`}>
                            {isActive && <span className="mr-1">Chương {chap.chapterNumber}:</span>}
                            {!isActive && isSucceeded && <span className="mr-1 opacity-70">Chương {chap.chapterNumber}:</span>}
                            {chap.title || 'Chương không có tựa đề'}
                          </span>
                          {!isSucceeded && (
                            <span className={`text-[10px] font-semibold mt-1 tracking-wide uppercase ${
                              isPending ? 'text-warning' : 'text-error'
                            }`}>
                              {isPending ? 'Chờ dịch' : 'Lỗi'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
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
               onClick={() => { setShowChapterDrawer(false); onNavigate({ type: 'book', bookId , rootTab}); }}
               className="w-full py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-variant transition-colors text-sm font-semibold"
            >
              Xem chi tiết truyện
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="flex-1 w-full max-w-reading-max-width mx-auto px-4 sm:px-12 lg:px-20 pt-18 pb-16 cursor-pointer"
        onClick={handleContentClick}
        ref={contentRef}
      >
        <article
          lang="vi"
          className="max-w-none will-change-contents"
          style={articleStyle}
        >
          <h4 className="font-headline-md text-primary mb-2 text-center font-bold" style={titleStyle}>
            {content.chapter.title}
          </h4>
          
          <ContentRenderer paragraphs={content.chapter.content} />
          
          <div className="w-16 h-[2px] bg-outline-variant-30 mt-8 mx-auto rounded-full"></div>
        </article>
      </main>

      <div aria-hidden="true">
        {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
        {showTranslation && <TranslationSheet onClose={() => setShowTranslation(false)} currentBookName={content.chapter.bookName} currentChapterName={`Chương ${content.chapter.chapterNumber}: ${content.chapter.title}`} currentBookId={bookId} initialSelectedChapters={[chapterId]} onSuccess={fetchChapter} />}
        {showEditWord && <EditWordSheet onClose={() => setShowEditWord(false)} initialMatch={selectedText} currentBookId={bookId} currentChapterId={chapterId} />}
      </div>

      {/* Bottom Controls Overlay */}
      <nav 
        aria-hidden="true"
        className={cn(
          "fixed bottom-0 left-0 w-full z-50 transition-transform duration-500 will-change-transform ease-out",
          showControls ? "translate-y-0" : "translate-y-full",
          "text-on-surface"
        )}
      >
        {/* Apple Glass Background */}
        <div className="absolute inset-0 bg-surface/75 backdrop-blur-[32px] saturate-150 border-t border-outline-variant/30 shadow-[0_-4px_32px_max(rgba(0,0,0,0.15),var(--color-shadow,transparent))]"></div>
        
        {/* Content */}
        <div className="relative z-10 w-full max-w-reading-max-width mx-auto pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-between items-center px-1 sm:px-6 py-2">
            <button 
              disabled={!content.navigation?.prev?.chapterId}
              onClick={() => content.navigation?.prev?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.prev.chapterId, rootTab })}
              className="flex flex-col items-center justify-center p-2.5 min-w-[64px] sm:min-w-[80px] rounded-2xl group disabled:opacity-30 transition-all active:scale-95 text-primary hover:bg-primary/10"
            >
               <ChevronLeft size={22} className="mb-1 group-hover:-translate-x-1 group-active:-translate-x-1.5 transition-transform duration-300" />
               <span className="text-[10px] font-semibold tracking-wide">Trước</span>
            </button>

            <button 
              onClick={() => { setShowTranslation(true); setShowControls(false); }}
              className="flex flex-col items-center justify-center p-2.5 min-w-[64px] sm:min-w-[80px] rounded-2xl group transition-all active:scale-95 text-primary hover:bg-primary/10"
            >
               <Languages size={22} className="mb-1 group-hover:-translate-y-0.5 transition-transform duration-300" />
               <span className="text-[10px] font-semibold tracking-wide">Dịch</span>
            </button>

           <button 
               onClick={() => { setShowSettings(true); setShowControls(false); }}
              className="flex flex-col items-center justify-center p-2.5 min-w-[64px] sm:min-w-[80px] rounded-2xl group transition-all active:scale-95 text-primary hover:bg-primary/10"
            >
               <Type size={22} className="mb-1 group-hover:-translate-y-0.5 transition-transform duration-300" />
               <span className="text-[10px] font-semibold tracking-wide">Cài đặt</span>
            </button>
            
            <button 
              onClick={() => { setShowEditWord(true); setShowControls(false); }}
              className={cn(
                "flex flex-col items-center justify-center p-2.5 min-w-[64px] sm:min-w-[80px] rounded-2xl relative group transition-all active:scale-95 hover:bg-primary/10",
                selectedText ? "text-primary bg-primary/10" : "text-primary"
              )}
            >
               <div className="relative mb-1 group-hover:-translate-y-0.5 transition-transform duration-300">
                 <Edit3 size={22} />
                 {selectedText && (
                   <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping opacity-75"></span>
                 )}
                 {selectedText && (
                   <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-surface opacity-90 shadow-sm"></span>
                 )}
               </div>
               <span className="text-[10px] font-semibold tracking-wide">Thay thế</span>
            </button>
            
            <button 
              disabled={!content.navigation?.next?.chapterId}
              onClick={() => content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId, rootTab })}
              className="flex flex-col items-center justify-center p-2.5 min-w-[64px] sm:min-w-[80px] rounded-2xl group disabled:opacity-30 transition-all active:scale-95 text-primary hover:bg-primary/10"
            >
               <ChevronRight size={22} className="mb-1 group-hover:translate-x-1 group-active:translate-x-1.5 transition-transform duration-300" />
               <span className="text-[10px] font-semibold tracking-wide">Sau</span>
            </button>
          </div>
        </div>
      </nav>
      
      <div aria-hidden="true">
        <LoadingOverlay isLoading={isLoadingContent} message="Đang tải nội dung chương..." />
      </div>
    </div>
  );
}
