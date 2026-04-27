import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { ArrowLeft, Menu, List, ChevronLeft, ChevronRight, Type, Languages, Edit3, X, Home, Lock, AlertCircle, Settings, Sparkles, BookOpen } from 'lucide-react';
import { AppView } from '../App';
import { api, ChapterContent, Chapter } from '../lib/api';
import { TranslationSheet } from '../components/TranslationSheet';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';
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
  const [showTranslation, setShowTranslation] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
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
          "fixed top-0 left-0 w-full z-40 transition-transform duration-500 will-change-transform ease-out", 
          "translate-y-0",
          "text-on-surface"
        )}
      >
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-[32px] saturate-150 border-b border-outline-variant/20 shadow-[0_4px_32px_max(rgba(0,0,0,0.1),var(--color-shadow,transparent))]"></div>
        <div className="relative z-10 max-w-reading-max-width mx-auto w-full px-3 py-2 flex justify-between items-center h-14 sm:h-16 pt-[max(env(safe-area-inset-top),8px)]">
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => onNavigate({ type: 'book', bookId, rootTab })} 
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Về chi tiết truyện"
            >
              <ArrowLeft size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-3">
            <h1 className="font-sans font-extrabold truncate text-[13px] sm:text-base max-w-[200px] sm:max-w-md w-full text-center leading-tight text-on-surface tracking-tight">
              {content.chapter.bookName}
            </h1>
            <div className="flex items-center mt-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-on-surface bg-surface-container-high border border-outline-variant/20 px-2 sm:px-2.5 py-0.5 rounded-[6px] tracking-widest uppercase shadow-sm">
                Chương {content.chapter.chapterNumber}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-end shrink-0 w-10">
            <button 
              onClick={() => onNavigate({ type: 'library' })} 
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Về trang chủ"
            >
              <Home size={20} />
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
        {showTranslation && <TranslationSheet onClose={() => setShowTranslation(false)} currentBookName={content.chapter.bookName} currentChapterName={`Chương ${content.chapter.chapterNumber}: ${content.chapter.title}`} currentBookId={bookId} initialSelectedChapters={[chapterId]} onSuccess={fetchChapter} />}
        {showGlobalSettings && <GlobalSettingsSheet onClose={() => setShowGlobalSettings(false)} initialMatch={selectedText} currentBookId={bookId} currentChapterId={chapterId} />}
      </div>

      {/* Bottom Controls Overlay */}
      <nav 
        aria-hidden="true"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] pointer-events-none drop-shadow-[0_-4px_16px_rgba(0,0,0,0.05)] transition-transform duration-500 will-change-transform ease-out",
          showControls ? "translate-y-0" : "translate-y-[calc(100%+48px)]"
        )}
      >
        <div className="flex justify-center w-full mt-4">
          <div className="relative flex items-center justify-between px-2 h-[55px] mx-auto w-full pointer-events-auto">
            
            {/* Advanced Curved Background (SVG) */}
            <div className="absolute inset-x-0 bottom-0 w-full h-[55px] -z-10">
              <svg width="100%" height="100%" viewBox="0 0 375 64" preserveAspectRatio="none" className="absolute inset-0 w-full h-full text-surface fill-current drop-shadow-sm">
                {/* Solid backdrop */}
                <path 
                  d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24 V64 H0 V24 Z" 
                />
                {/* Full top border spanning the curve and rounded edges */}
                <path 
                  d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24" 
                  fill="none"
                  className="stroke-outline-variant/30"
                  strokeWidth="1.5"
                />
                {/* Center highlight over the curve */}
                <path 
                  d="M130 0 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0" 
                  fill="none"
                  className="stroke-primary/40"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Left Items */}
            <div className="flex items-center w-[120px] justify-between pl-3 sm:pl-4">
              {/* 1. Trước */}
              <button 
                disabled={!content.navigation?.prev?.chapterId}
                onClick={() => content.navigation?.prev?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.prev.chapterId, rootTab })}
                className="relative flex items-center justify-center w-12 h-[64px] disabled:opacity-30 transition-all duration-300 group"
              >
                 <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                   <ChevronLeft size={28} strokeWidth={2.5} />
                 </div>
              </button>

              {/* 2. Menu */}
              <button 
                onClick={() => { 
                  setShowChapterDrawer(true); 
                  setShowControls(false); 
                  if (bookChapters.length === 0) {
                    loadMoreChapters(1);
                  }
                }}
                className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
              >
                 <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                   <List size={26} strokeWidth={2.5} />
                 </div>
              </button>
            </div>

            {/* Center Floating: 3. Dịch AI */}
            <div className="relative flex flex-col items-center -mt-8 mb-[8px] shrink-0 group">
              {/* Outer pulsing ring */}
             
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" style={{ animationDuration: '2s' }}></div>
              
              <button 
                onClick={() => { setShowTranslation(true); setShowControls(false); }}
                className="relative flex items-center justify-center w-[48px] h-[48px] rounded-full bg-primary text-on-primary shadow-[0_10px_24px_-4px_rgba(0,0,0,0.4),inset_0_4px_8px_rgba(255,255,255,0.4),inset_0_-6px_12px_rgba(0,0,0,0.3)] transition-all duration-300 active:scale-90 hover:scale-105 overflow-hidden"
              >
                 {/* Animated Conic gradient spin for a rotating light effect */}
                 <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_280deg,white_360deg)] animate-[spin_2s_linear_infinite] opacity-40"></div>
                 
                 {/* Inner background block so the spin only shows on the border */}
                 <div className="absolute inset-[2px] rounded-full bg-primary shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]"></div>

                 {/* Glassy top highlight */}
                 <div className="absolute top-[2px] inset-x-[6px] h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full opacity-90 pointer-events-none"></div>
                 
                 <Sparkles size={26} strokeWidth={2.5} className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] animate-[pulse_2s_ease-in-out_infinite]" />
              </button>
            </div>

            {/* Right Items */}
            <div className="flex items-center w-[120px] justify-between pr-3 sm:pr-4">
              {/* 4. Cài đặt */}
              <button 
                onClick={() => { setShowGlobalSettings(true); setShowControls(false); }}
                className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
              >
                 <div className={cn("relative transition-all duration-300 group-hover:scale-110 active:scale-95", selectedText ? "text-primary drop-shadow-md" : "text-on-surface-variant group-hover:text-on-surface")}>
                   <Settings size={26} strokeWidth={2.5} />
                   {selectedText && (
                     <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface"></span>
                   )}
                 </div>
              </button>

              {/* 5. Sau */}
              <button 
                disabled={!content.navigation?.next?.chapterId}
                onClick={() => content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId, rootTab })}
                className="relative flex items-center justify-center w-12 h-[64px] disabled:opacity-30 transition-all duration-300 group"
              >
                 <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                   <ChevronRight size={28} strokeWidth={2.5} />
                 </div>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <div aria-hidden="true">
        <LoadingOverlay isLoading={isLoadingContent} message="Đang tải nội dung chương..." />
      </div>
    </div>
  );
}
