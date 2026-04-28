import React, { useState, useEffect } from 'react';
import { X, Languages, Settings2, Sparkles, CheckSquare, Square, Search, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { Book, Chapter, api } from '../lib/api';
import { cn } from '../lib/utils';
import { showToast } from './Toast';

type Tab = 'current' | 'batch_chapter' | 'story';

interface TranslationOptions {
  model: string;
  minWords: number;
  maxWords: number;
  temperature: number;
  forceRetranslate: boolean;
  availableModels?: string[];
}

const defaultOptions: TranslationOptions = {
  model: 'gemini-2.5-flash-lite',
  minWords: 100,
  maxWords: 500,
  temperature: 0.7,
  forceRetranslate: false,
  availableModels: ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-pro']
};

interface TranslationSheetProps {
  onClose: () => void;
  currentBookName?: string;
  currentChapterName?: string;
  currentBookId?: string;
  initialTab?: Tab;
  initialSelectedChapters?: string[];
  onSuccess?: () => void;
}

export function TranslationSheet({ onClose, currentBookName, currentChapterName, currentBookId, initialTab = 'current', initialSelectedChapters = [], onSuccess }: TranslationSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
  const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set(initialSelectedChapters));
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [searchBook, setSearchBook] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);

  // Load configs from API
  useEffect(() => {
    let active = true;
    
    api.getSettings('stories.ui.translate').then(res => {
      if (!active) return;
      if (res && res.value) {
        try {
          const parsed = typeof res.value === 'string' ? JSON.parse(res.value) : res.value;
          setOptions(prev => {
            const newOptions = { ...prev, ...parsed };
            // Optional: Cleanup options locally if needed
            const { _id, key, value, type, updatedAt, ...cleanOptions } = newOptions as any;
            return cleanOptions;
          });
        } catch (e) {
          console.error("Failed to parse translate settings", e);
        }
      }
      setIsOptionsLoaded(true);
    });

    return () => { active = false; };
  }, []);

  // Save configs to API
  const initialMount = React.useRef(true);
  useEffect(() => {
    if (isOptionsLoaded) {
      if (initialMount.current) {
        initialMount.current = false;
        return;
      }
      const t = setTimeout(() => {
        const payload = {
          model: options.model,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          forceRetranslate: options.forceRetranslate,
          availableModels: options.availableModels
        };
        api.updateSettings('stories.ui.translate', JSON.stringify(payload));
      }, 500);
      return () => clearTimeout(t);
    }
  }, [options, isOptionsLoaded]);

  useEffect(() => {
    if (activeTab === 'batch_chapter' && currentBookId) {
      api.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC').then(res => setChapters(res.chapters));
    } else if (activeTab === 'story') {
      api.getBooks().then(res => setBooks(res.data));
    }
  }, [activeTab, currentBookId]);

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (activeTab === 'current') {
        if (!initialSelectedChapters[0]) {
          showToast("Không xác định được chương hiện tại", "error");
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }
        
        showToast("Đang dịch chương...", "info");
        onClose();
        const response = await api.translate({
          mode: 'current',
          model: options.model,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          bookId: currentBookId,
          chapterId: initialSelectedChapters
        });
        
        const chapResult = response?.[initialSelectedChapters[0]]?.chapter;
        if (chapResult?.state === 'SUCCEEDED') {
          showToast(`Dịch thành công! Mất ${chapResult.totalTokens} tokens`, 'success');
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 1500);
        } else {
           throw new Error("Lỗi khi dịch chương này");
        }
      } else if (activeTab === 'batch_chapter' && currentBookId) {
        if (selectedChapters.size === 0) {
          showToast("Vui lòng chọn ít nhất 1 chương", "error");
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }
        
        await api.translate({
          mode: 'batch_chapter',
          model: options.model,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          bookId: currentBookId,
          chapterId: Array.from(selectedChapters),
          currentChapterId: initialSelectedChapters[0]
        });
        showToast(`Đã gửi yêu cầu dịch ${selectedChapters.size} chương`, 'success');
        setTimeout(() => onClose(), 1500);

      } else if (activeTab === 'story') {
        if (selectedBooks.size === 0) {
          showToast("Vui lòng chọn ít nhất 1 truyện", "error");
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }
        
        await api.translate({
          mode: 'story',
          model: options.model,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          bookId: Array.from(selectedBooks),
          currentChapterId: initialSelectedChapters[0]
        });
        showToast(`Đã gửi yêu cầu dịch ${selectedBooks.size} truyện`, 'success');
        setTimeout(() => onClose(), 1500);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Có lỗi xảy ra, vui lòng thử lại", 'error');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const toggleChapter = (id: string) => {
    const next = new Set(selectedChapters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedChapters(next);
  };

  const toggleBook = (id: string) => {
    const next = new Set(selectedBooks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBooks(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-surface-container text-on-surface w-full max-w-[680px] mx-auto rounded-t-3xl sm:rounded-2xl max-h-[90vh] h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-10 overflow-hidden border-t sm:border border-outline-variant/30">
        
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0 pt-3 px-4 sm:px-5 pb-3 border-b border-outline-variant/10">
          <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-2 sm:mb-3"></div>
          <div className="flex justify-between items-center bg-surface-container p-1 rounded-xl">
             <div className="flex bg-surface-container-low p-1 rounded-lg flex-1">
               <TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')}>Hiện tại</TabButton>
               <TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>Nhiều chương</TabButton>
               <TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>Truyện</TabButton>
             </div>
             <button onClick={onClose} className="p-2 ml-2 bg-surface-container-highest/50 rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
               <X size={18} className="sm:w-5 sm:h-5" />
             </button>
          </div>
        </div>


        {/* Global Config (Stuck below header) */}
        <div className="flex-shrink-0 bg-surface-container-low border-b border-outline-variant/10">
          <div 
            className="w-full flex items-center justify-between py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:bg-surface-container-high transition-colors cursor-pointer select-none"
            onClick={() => setShowConfig(!showConfig)}
          >
            <div className="flex items-center gap-2">
              <Settings2 size={12} />
              <span>Cấu hình AI</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setOptions({...options, forceRetranslate: !options.forceRetranslate});
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all active:scale-95",
                  options.forceRetranslate 
                    ? "bg-primary text-on-primary shadow-sm shadow-primary/20" 
                    : "bg-surface-container-highest text-on-surface-variant/50"
                )}
                title="Dịch lại toàn bộ"
              >
                <Sparkles size={12} />
              </button>
              {showConfig ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
          </div>
          
          {showConfig && (
            <div className="px-4 p-4 flex flex-col gap-3 max-h-[40vh] overflow-y-auto hide-scrollbar">
              {/* Model selection as chips for mobile */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">GIỚI HẠN TỪ</label>
                  <div className="flex items-center bg-surface-container-highest rounded-lg p-1">
                    <input 
                      type="number" value={options.minWords}
                      onChange={(e) => setOptions({...options, minWords: Number(e.target.value)})}
                      className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
                    />
                    <span className="text-on-surface-variant/30 text-[10px]">-</span>
                    <input 
                      type="number" value={options.maxWords}
                      onChange={(e) => setOptions({...options, maxWords: Number(e.target.value)})}
                      className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                   <div className="flex justify-between items-center px-0.5">
                     <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">SÁNG TẠO</label>
                     <span className="text-[10px] font-bold text-primary">{Number(options.temperature).toFixed(1)}</span>
                   </div>
                   <div className="bg-surface-container-highest rounded-lg p-1 px-2 h-full flex items-center">
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={options.temperature}
                       onChange={(e) => setOptions({...options, temperature: Number(e.target.value)})}
                       className="w-full accent-primary h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer"
                     />
                   </div>
                </div>
              </div>
                <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">MODEL</label>
                <div className="flex flex-wrap gap-1.5">
                  {(options.availableModels || defaultOptions.availableModels || []).map(m => (
                    <button
                      key={m}
                      onClick={() => setOptions({...options, model: m})}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all break-words leading-tight flex-grow sm:flex-grow-0 min-w-0 text-center",
                        options.model === m 
                          ? "bg-primary/10 border-primary/30 text-primary" 
                          : "bg-surface-container-highest border-transparent text-on-surface-variant"
                      )}
                    >
                      {m.replace(/^gemini-/, '').replace(/-/g, ' ').toUpperCase() || m}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Scrollable Dynamic Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 flex flex-col">
          {activeTab === 'current' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <p className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Chương đang mở</p>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-snug">{currentChapterName || 'Chưa chọn chương'}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-2 font-medium">{currentBookName}</p>
            </div>
          )}

          {activeTab === 'batch_chapter' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">Chọn chương ({selectedChapters.size}/{chapters.length})</p>
                <button 
                  onClick={() => setSelectedChapters(new Set(chapters.filter(c => c.state === 'FAILED').map(c => c.chapterId)))}
                  className="text-xs text-primary font-bold hover:opacity-80 transition-opacity"
                >
                  Chọn chưa dịch
                </button>
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 bg-surface-container-lowest rounded-xl min-h-[30vh]">
                {[...chapters].sort((a, b) => {
                  const aH = selectedChapters.has(a.chapterId) ? 1 : 0;
                  const bH = selectedChapters.has(b.chapterId) ? 1 : 0;
                  if (aH !== bH) return bH - aH;
                  return a.chapterNumber - b.chapterNumber;
                }).map(chap => (
                  <div 
                    key={chap.chapterId} 
                    onClick={() => toggleChapter(chap.chapterId)}
                    className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-all active:scale-[0.98] ${selectedChapters.has(chap.chapterId) ? 'bg-primary/10 border border-primary/20' : 'bg-surface hover:bg-surface-container border border-transparent'}`}
                  >
                    <button className="text-on-surface-variant flex-shrink-0">
                      {selectedChapters.has(chap.chapterId) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                    </button>
                    <span className="text-sm flex-1 truncate font-medium">Chương {chap.chapterNumber}: {chap.title}</span>
                    {chap.state === 'FAILED' && <span className="text-[9px] bg-warning/20 text-warning px-2 py-1 rounded-md font-bold tracking-wider">CHỜ DỊCH</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'story' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant sm:left-3.5" size={14} />
                <input 
                  type="text" 
                  placeholder="Tìm truyện..." 
                  value={searchBook}
                  onChange={(e) => setSearchBook(e.target.value)}
                  className="w-full bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm focus:outline-none focus:border-primary/50 focus:bg-surface transition-all placeholder:text-on-surface-variant/70"
                />
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 bg-surface-container-lowest rounded-xl min-h-[30vh]">
                {books.filter(b => b.bookName.toLowerCase().includes(searchBook.toLowerCase())).map(book => (
                  <div 
                    key={book.bookId} 
                    onClick={() => toggleBook(book.bookId)}
                    className={`flex items-center gap-3 rounded-lg p-2.5 cursor-pointer transition-all active:scale-[0.98] ${selectedBooks.has(book.bookId) ? 'bg-primary/10 border border-primary/20' : 'bg-surface hover:bg-surface-container border border-transparent'}`}
                  >
                    <button className="text-on-surface-variant flex-shrink-0">
                      {selectedBooks.has(book.bookId) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                    </button>
                    <span className="text-sm flex-1 truncate font-medium">{book.bookName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        
        {/* Action Button */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-outline-variant/30 bg-surface-container pb-safe">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 sm:py-4 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold font-sans flex items-center justify-center gap-2 hover:bg-primary-fixed active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader size={18} className="animate-spin sm:w-5 sm:h-5 text-on-primary" />
            ) : (
              <Sparkles size={18} className="fill-black/50 sm:w-5 sm:h-5" />
            )}
            
            {activeTab === 'current' ? (isSubmitting ? 'Đang Dịch...' : 'Dịch Ngay Chương Này') : 
             activeTab === 'batch_chapter' ? `Dịch ${selectedChapters.size} Chương Đã Chọn` : 
             `Dịch ${selectedBooks.size} Truyện Đã Chọn`}
          </button>
        </div>

      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-[13px] font-bold rounded-lg transition-all duration-200 ${active ? 'bg-surface text-primary shadow-sm border border-outline-variant/10' : 'text-on-surface-variant hover:text-on-surface border border-transparent'}`}
    >
      {children}
    </button>
  );
}

