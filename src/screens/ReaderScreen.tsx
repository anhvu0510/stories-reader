import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { ArrowLeft, Menu, List, ChevronLeft, ChevronRight, Type, Languages, Edit3, X, Home, Lock, AlertCircle, Settings, Sparkles, BookOpen, PlayCircle, PauseCircle, Search, StopCircle, SkipForward, Play, Pause, Loader2 } from 'lucide-react';
import { AppView } from '../App';
import { api, ChapterContent, Chapter } from '../lib/api';
import { TranslationSheet } from '../components/TranslationSheet';
import { GlobalSettingsSheet } from '../components/GlobalSettingsSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useReaderSettings } from '../contexts/ReaderContext';
import { useReadAloud } from '../hooks/useReadAloud';
import { cn } from '../lib/utils';
import { ChapterList } from '../components/ChapterList';

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
  const [drawerSearch, setDrawerSearch] = useState('');
  const { theme, font, fontSize, lineHeight, groupLines, isEnabledReplace } = useReaderSettings();

  const { isPlaying, isPaused, startReading, pauseReading, stopReading, jumpToContent, nextSection } = useReadAloud(content?.chapter?.content || []);
  const [showAudioBar, setShowAudioBar] = useState(false);

  const jumpToContentRef = useRef(jumpToContent);
  const isReadAloudActiveRef = useRef(isPlaying || isPaused);

  useEffect(() => {
    jumpToContentRef.current = jumpToContent;
    isReadAloudActiveRef.current = isPlaying || isPaused;
    if (!isPlaying && !isPaused) {
      setShowAudioBar(false);
    }
  }, [jumpToContent, isPlaying, isPaused]);

  const contentRef = useRef<HTMLDivElement>(null);

  // Keep track of the last loaded chapter to avoid scrolling to top on toggle
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);

  const loadingContentRequestRef = useRef(0);

  const fetchChapter = () => {
    const reqId = ++loadingContentRequestRef.current;
    setIsLoadingContent(true);
    api.getChapterContent(chapterId, groupLines, isEnabledReplace, rootTab).then(res => {
      if (loadingContentRequestRef.current !== reqId) return;
      setContent(res);
      setIsLoadingContent(false);
      
      if (lastChapterId !== chapterId) {
        window.scrollTo(0, 0);
        setLastChapterId(chapterId);
      }
    }).catch(() => {
      if (loadingContentRequestRef.current === reqId) {
        setIsLoadingContent(false);
      }
    });
  };

  useEffect(() => {
    fetchChapter();
  }, [chapterId, groupLines, isEnabledReplace]);

  const loadingRequestRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastChapterElementRef = useCallback((node: HTMLButtonElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (isLoadingChapters) return;
    
    if (!hasMoreChapters) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreChapters && !isLoadingChapters) {
        loadMoreChapters(drawerPage);
      }
    });
    if (node) observerRef.current.observe(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingChapters, hasMoreChapters, drawerPage]);

  const debouncedSearchRef = useRef(drawerSearch);

  const loadMoreChapters = async (pageToLoad: number, overrideSearch?: string) => {
    const currentSearch = typeof overrideSearch !== 'undefined' ? overrideSearch : debouncedSearchRef.current;
    if (pageToLoad > 1 && !hasMoreChapters) return;
    
    const requestId = ++loadingRequestRef.current;
    
    if (pageToLoad === 1) {
      setBookChapters([]);
    }
    
    setIsLoadingChapters(true);
    try {
      const res = await api.getChapters(bookId, pageToLoad, 50, 'chapterNumber', 'ASC', undefined, currentSearch || undefined);
      if (loadingRequestRef.current !== requestId) return;

      setBookChapters(prev => {
        if (pageToLoad === 1) return res.chapters || [];
        const newChapters = (res.chapters || []).filter(c => !prev.some(p => p.chapterId === c.chapterId));
        return [...prev, ...newChapters];
      });
      if ((res.chapters || []).length === 0 || (res.chapters || []).length < 50 || pageToLoad >= (res.pagination?.totalPages || 1)) {
        setHasMoreChapters(false);
      } else {
        setHasMoreChapters(true);
      }
      setDrawerPage(pageToLoad + 1);
    } catch (e) {
      if (loadingRequestRef.current !== requestId) return;
      console.error(e);
    } finally {
      if (loadingRequestRef.current === requestId) {
        setIsLoadingChapters(false);
      }
    }
  };

  const prevSearchRef = useRef(drawerSearch);
  
  useEffect(() => {
    if (!showChapterDrawer) return;
    const timer = setTimeout(() => {
      if (prevSearchRef.current !== drawerSearch) {
        prevSearchRef.current = drawerSearch;
        debouncedSearchRef.current = drawerSearch;
        loadMoreChapters(1, drawerSearch);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [drawerSearch, showChapterDrawer]);

  useEffect(() => {
    let selectionTimeout: NodeJS.Timeout;
    const handleSelectionChange = () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          if (isReadAloudActiveRef.current) {
             // In read aloud mode, don't set selectedText for replace settings. Just jump.
            const range = selection.getRangeAt(0);
            const container = range.startContainer;
            const mb4Div = container.nodeType === Node.TEXT_NODE ? container.parentElement?.closest('div.mb-4') : (container as HTMLElement).closest('div.mb-4');
            
            if (mb4Div) {
              const article = mb4Div.closest('article');
              if (article) {
                const pNodes = Array.from(article.querySelectorAll(':scope > div.mb-4'));
                const pIdx = pNodes.indexOf(mb4Div);
                if (pIdx !== -1) {
                  let offset = 0;
                  const walker = document.createTreeWalker(mb4Div, NodeFilter.SHOW_TEXT, null);
                  let node;
                  while ((node = walker.nextNode())) {
                    if (node === container) {
                      offset += range.startOffset;
                      break;
                    }
                    offset += node.nodeValue?.length || 0;
                  }

                  const textContent = mb4Div.textContent || '';
                  while (offset > 0 && !/[\s.,;!?"'()[\]{}—\-“”‘’]/.test(textContent[offset - 1])) {
                    offset--;
                  }
                  
                  jumpToContentRef.current(pIdx, offset);
                  
                  // Clear selection so the browser selection goes away
                  window.getSelection()?.removeAllRanges();
                }
              }
            }
          } else {
            setSelectedText(selection.toString().trim());
            setShowControls(true); // Auto show controls when text is selected
          }
        } else {
          setSelectedText('');
        }
      }, 150); // 150ms debounce
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      clearTimeout(selectionTimeout);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Click outside to toggle controls
  const handleContentClick = (e: React.MouseEvent) => {
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
          <div className="flex items-center shrink-0 gap-2 w-[88px]">
            <button 
              onClick={() => { stopReading(); onNavigate({ type: 'book', bookId, rootTab }); }} 
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Về chi tiết truyện"
            >
              <ArrowLeft size={20} />
            </button>
            <button 
              onClick={() => { stopReading(); onNavigate({ type: 'library' }); }} 
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Về trang chủ"
            >
              <Home size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
            <h1 className="font-sans font-extrabold truncate text-[13px] sm:text-base max-w-[150px] sm:max-w-md w-full text-center leading-tight text-on-surface tracking-tight">
              {content.chapter.bookName}
            </h1>
            <div className="flex items-center mt-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-on-surface bg-surface-container-high border border-outline-variant/20 px-2 sm:px-2.5 py-0.5 rounded-[6px] tracking-widest uppercase shadow-sm">
                Chương {content.chapter.chapterNumber}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-end shrink-0 w-[88px]">
            <button 
              onClick={() => { 
                setShowChapterDrawer(true); 
                setShowControls(false); 
                if (bookChapters.length === 0) {
                  loadMoreChapters(1);
                }
              }}
              className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-95 bg-surface-container-lowest/50 rounded-full border border-outline-variant/30 flex-shrink-0 shadow-sm backdrop-blur-md"
              title="Mục lục"
            >
              <List size={20} />
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
          <div className="p-4 border-b border-surface-variant flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Mục lục</h2>
              <button onClick={() => setShowChapterDrawer(false)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Nhập phần chữ số ở tên chương..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Hide soft keyboard on mobile after search
                    e.currentTarget.blur();
                  }
                }}
                className="w-full bg-surface-container-lowest/50 text-on-surface border border-outline-variant/30 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
            {bookChapters.length === 0 && isLoadingChapters ? (
              <div className="flex justify-center items-center h-20 text-on-surface-variant text-sm">Đang tải mục lục...</div>
            ) : (
              <>
                <ChapterList
                  chapters={bookChapters}
                  variant="compact"
                  activeChapterId={chapterId}
                  onChapterClick={(chap) => {
                    stopReading();
                    setShowChapterDrawer(false);
                    onNavigate({ type: 'reader', bookId, chapterId: chap.chapterId, rootTab });
                  }}
                />
                {hasMoreChapters && (
                  <div ref={lastChapterElementRef} className="h-4 w-full" aria-hidden="true" />
                )}
                {bookChapters.length > 0 && hasMoreChapters && (
                  <div className="py-6 flex justify-center w-full min-h-[72px]">
                    {isLoadingChapters && <Loader2 className="animate-spin text-primary" size={24} />}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-4 border-t border-surface-variant bg-surface pb-safe-bottom">
            <button
               onClick={() => { stopReading(); setShowChapterDrawer(false); onNavigate({ type: 'book', bookId , rootTab}); }}
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
            {/* Shared Advanced Curved Background (SVG) */}
            <div className="absolute inset-x-0 bottom-0 w-full h-[55px] -z-10">
              <svg width="100%" height="100%" viewBox="0 0 375 64" preserveAspectRatio="none" className="absolute inset-0 w-full h-full drop-shadow-sm style-nav-bg">
                {/* Solid backdrop */}
                <path d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24 V64 H0 V24 Z" className="nav-bg-fill" />
                {/* Full top border spanning the curve and rounded edges */}
                <path d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24" fill="none" className="stroke-outline-variant/30" strokeWidth="1.5" />
                {/* Center highlight over the curve */}
                <path d="M130 0 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0" fill="none" className="stroke-primary/40" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {showAudioBar ? (
              <>
                {/* Audio Left Items */}
                <div className="flex items-center w-[120px] justify-between pl-3 sm:pl-4">
                  {/* 1. Next Chương */}
                  <button 
                    disabled={!content.navigation?.next?.chapterId}
                    onClick={() => {
                      stopReading();
                      content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId, rootTab })
                    }}
                    className="relative flex items-center justify-center w-12 h-[64px] disabled:opacity-30 transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                       <ChevronRight size={28} strokeWidth={2.5} />
                     </div>
                  </button>

                  {/* 2. Next Đoạn */}
                  <button 
                    onClick={() => nextSection()}
                    className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                       <SkipForward size={26} strokeWidth={2.5} />
                     </div>
                  </button>

              
                </div>

                {/* Audio Center Floating */}
                <div className="relative flex flex-col items-center -mt-8 mb-[8px] shrink-0 group z-10">
                  <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" style={{ animationDuration: '2s' }}></div>
                  <button 
                    onClick={() => isPlaying ? pauseReading() : startReading()}
                     className="relative flex items-center justify-center w-[48px] h-[48px] rounded-full bg-primary text-on-primary shadow-[0_10px_24px_-4px_rgba(0,0,0,0.4),inset_0_4px_8px_rgba(255,255,255,0.4),inset_0_-6px_12px_rgba(0,0,0,0.3)] transition-all duration-300 active:scale-90 hover:scale-105 overflow-hidden"
                  >
                     <div className="absolute inset-[2px] rounded-full bg-primary shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]"></div>
                     <div className="absolute top-[2px] inset-x-[6px] h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full opacity-90 pointer-events-none"></div>
                     
                     <div className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                        {isPlaying ? <Pause fill="currentColor" size={24} strokeWidth={2.5} /> : <Play fill="currentColor" size={24} strokeWidth={2.5} className="ml-1" />}
                     </div>
                  </button>
                </div>

                {/* Audio Right Items */}
                <div className="flex items-center w-[120px] justify-between pr-3 sm:pr-4">
                      {/* 4. Stop */}
                  <button 
                    onClick={() => { stopReading(); setShowAudioBar(false); }}
                    className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-error hover:text-error/80 group-hover:scale-110 active:scale-95">
                       <StopCircle size={26} strokeWidth={2.5} />
                     </div>
                  </button>

                  {/* 5. Menu Cũ */}
                  <button 
                    onClick={() => setShowAudioBar(false)}
                    className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                       <List size={26} strokeWidth={2.5} />
                     </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Left Items */}
                <div className="flex items-center w-[120px] justify-between pl-3 sm:pl-4">
                  {/* 1. Trước */}
                  <button 
                    disabled={!content.navigation?.prev?.chapterId}
                    onClick={() => {
                      stopReading();
                      content.navigation?.prev?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.prev.chapterId, rootTab })
                    }}
                    className="relative flex items-center justify-center w-12 h-[64px] disabled:opacity-30 transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                       <ChevronLeft size={28} strokeWidth={2.5} />
                     </div>
                  </button>

                  {/* 2. Dịch AI */}
                  <div className="relative">
                    <button 
                      onClick={() => { setShowTranslation(true); setShowControls(false); }}
                      className="relative flex items-center justify-center w-12 h-[64px] transition-all duration-300 group"
                    >
                       <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                         <Sparkles size={26} strokeWidth={2.5} />
                       </div>
                    </button>
                  </div>
                </div>

                {/* Center Floating: 3. Audio/Read */}
                <div className="relative flex flex-col items-center -mt-8 mb-[8px] shrink-0 group z-10">
                  {isPlaying && (
                    <>
                      <div className="absolute inset-[-4px] rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                      <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" style={{ animationDuration: '2s' }}></div>
                    </>
                  )}
                  {!isPlaying && (
                     <div className="absolute inset-0 rounded-full bg-primary/30 blur-md"></div>
                  )}
                  
                  <button 
                      onClick={() => { 
                        if (isPlaying || isPaused) {
                          setShowAudioBar(true);
                        } else {
                          startReading();
                          setShowAudioBar(true);
                        }
                      }}
                     className="relative flex items-center justify-center w-[48px] h-[48px] rounded-full bg-primary text-on-primary shadow-[0_10px_24px_-4px_rgba(0,0,0,0.4),inset_0_4px_8px_rgba(255,255,255,0.4),inset_0_-6px_12px_rgba(0,0,0,0.3)] transition-all duration-300 active:scale-90 hover:scale-105 overflow-hidden"
                  >
                     {isPlaying && (
                       <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_280deg,white_360deg)] animate-[spin_2s_linear_infinite] opacity-40"></div>
                     )}

                     <div className="absolute inset-[2px] rounded-full bg-primary shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]"></div>
                     <div className="absolute top-[2px] inset-x-[6px] h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full opacity-90 pointer-events-none"></div>
                     
                     <div className={cn("relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]", isPlaying && "animate-[pulse_2s_ease-in-out_infinite]")}>
                        {isPlaying ? <Pause fill="currentColor" size={24} strokeWidth={2.5} /> : <Play fill="currentColor" size={24} strokeWidth={2.5} className="ml-1" />}
                     </div>
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
                    onClick={() => {
                      stopReading();
                      content.navigation?.next?.chapterId && onNavigate({ type: 'reader', bookId, chapterId: content.navigation.next.chapterId, rootTab })
                    }}
                    className="relative flex items-center justify-center w-12 h-[64px] disabled:opacity-30 transition-all duration-300 group"
                  >
                     <div className="transition-all duration-300 text-on-surface-variant group-hover:text-on-surface group-hover:scale-110 active:scale-95">
                       <ChevronRight size={28} strokeWidth={2.5} />
                     </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
      
      <div aria-hidden="true">
        <LoadingOverlay isLoading={isLoadingContent} message="Đang tải nội dung chương..." />
      </div>
    </div>
  );
}
