import React, { useState, useEffect } from 'react';
import { X, Languages, Settings2, Sparkles, CheckSquare, Square, Search } from 'lucide-react';
import { Book, Chapter, api } from '../lib/api';

type Tab = 'current' | 'batch_chapter' | 'story';
type Model = 'gemini-2.5-flash-lite' | 'gemini-2.0-flash' | 'gemini-pro';

interface TranslationOptions {
  model: Model;
  minWords: number;
  maxWords: number;
  temperature: number;
  forceRetranslate: boolean;
}

const defaultOptions: TranslationOptions = {
  model: 'gemini-2.5-flash-lite',
  minWords: 100,
  maxWords: 500,
  temperature: 0.7,
  forceRetranslate: false
};

interface TranslationSheetProps {
  onClose: () => void;
  currentBookName?: string;
  currentChapterName?: string;
  currentBookId?: string;
  initialTab?: Tab;
  initialSelectedChapters?: string[];
}

export function TranslationSheet({ onClose, currentBookName, currentChapterName, currentBookId, initialTab = 'current', initialSelectedChapters = [] }: TranslationSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [options, setOptions] = useState<TranslationOptions>(() => {
    const saved = localStorage.getItem('novel_trans_opts_v1');
    return saved ? JSON.parse(saved) : defaultOptions;
  });

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set(initialSelectedChapters));
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [searchBook, setSearchBook] = useState('');

  useEffect(() => {
    localStorage.setItem('novel_trans_opts_v1', JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    if (activeTab === 'batch_chapter' && currentBookId) {
      api.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC').then(res => setChapters(res.chapters));
    } else if (activeTab === 'story') {
      api.getBooks().then(res => setBooks(res.data));
    }
  }, [activeTab, currentBookId]);

  const handleSubmit = () => {
    // In a real app, logic would call API and maybe show confirm modal for batch
    console.log("Submitting translation...", { tab: activeTab, options });
    if (activeTab === 'batch_chapter' || activeTab === 'story') {
       alert("Sẽ hiển thị modal xác nhận trước khi dịch hàng loạt (Demo)");
    } else {
       alert(`Đang tiến hành dịch chương: ${currentChapterName} (Demo)`);
       onClose();
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
          <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-4 sm:mb-5"></div>
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-serif text-lg sm:text-xl font-bold flex items-center gap-2 text-on-surface">
              <Languages size={18} className="text-primary sm:w-[22px] sm:h-[22px]" />
              Dịch thuật AI
            </h2>
            <button onClick={onClose} className="p-1.5 sm:p-2 bg-surface-container-highest/50 rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
          
          <div className="flex gap-1 sm:gap-2 mt-4 sm:mt-5 bg-surface-container-low p-1 rounded-xl">
            <TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')}>Hiện tại</TabButton>
            <TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>Nhiều chương</TabButton>
            <TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>Truyện</TabButton>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 flex flex-col gap-4 sm:gap-6 pb-24 sm:pb-32">
          
          {/* Tab Content */}
          <div className="bg-surface-container-low rounded-xl sm:rounded-2xl border border-outline-variant/10 p-4 sm:p-5">
            {activeTab === 'current' && (
              <div className="text-center py-4 sm:py-6">
                <p className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-2 sm:mb-3">Chương đang mở</p>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-snug">{currentChapterName || 'Chưa chọn chương'}</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 sm:mt-2 font-medium">{currentBookName}</p>
              </div>
            )}

            {activeTab === 'batch_chapter' && (
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">Chọn chương ({selectedChapters.size}/{chapters.length})</p>
                  <button 
                    onClick={() => setSelectedChapters(new Set(chapters.filter(c => c.state === 'FAILED').map(c => c.chapterId)))}
                    className="text-xs text-primary font-bold hover:opacity-80 transition-opacity"
                  >
                    Chọn chưa dịch
                  </button>
                </div>
                <div className="max-h-[35vh] overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 bg-surface-container-lowest rounded-xl">
                  {[...chapters].sort((a, b) => {
                    const aH = selectedChapters.has(a.chapterId) ? 1 : 0;
                    const bH = selectedChapters.has(b.chapterId) ? 1 : 0;
                    if (aH !== bH) return bH - aH;
                    return a.chapterNumber - b.chapterNumber;
                  }).map(chap => (
                    <div 
                      key={chap.chapterId} 
                      onClick={() => toggleChapter(chap.chapterId)}
                      className={`flex items-center gap-3 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${selectedChapters.has(chap.chapterId) ? 'bg-primary/10 border border-primary/20' : 'bg-surface hover:bg-surface-container border border-transparent'}`}
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
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant sm:left-3.5" size={14} />
                  <input 
                    type="text" 
                    placeholder="Tìm truyện..." 
                    value={searchBook}
                    onChange={(e) => setSearchBook(e.target.value)}
                    className="w-full bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm focus:outline-none focus:border-primary/50 focus:bg-surface transition-all placeholder:text-on-surface-variant/70"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 bg-surface-container-lowest rounded-xl">
                  {books.filter(b => b.bookName.toLowerCase().includes(searchBook.toLowerCase())).map(book => (
                    <div 
                      key={book.bookId} 
                      onClick={() => toggleBook(book.bookId)}
                      className={`flex items-center gap-3 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${selectedBooks.has(book.bookId) ? 'bg-primary/10 border border-primary/20' : 'bg-surface hover:bg-surface-container border border-transparent'}`}
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

          {/* Global Config */}
          <div className="flex flex-col gap-3 sm:gap-5">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2 px-1">
              <Settings2 size={14} className="sm:w-4 sm:h-4" />
              Cấu hình chung
            </h3>
            
            <div className="flex flex-col gap-3 sm:gap-5">
              {/* Model Select */}
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label className="text-[11px] sm:text-xs font-semibold text-on-surface-variant px-1">Model AI</label>
                <div className="relative">
                  <select 
                    value={options.model}
                    onChange={(e) => setOptions({...options, model: e.target.value as Model})}
                    className="w-full bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-surface appearance-none transition-all"
                  >
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Nhanh, Rẻ)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Cân bằng)</option>
                    <option value="gemini-pro">Gemini Pro (Chất lượng cao)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.41 0.589966L6 5.16997L10.59 0.589966L12 1.99997L6 7.99997L0 1.99997L1.41 0.589966Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Batch Size */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-on-surface-variant px-1">Min Words</label>
                  <input 
                    type="number" 
                    value={options.minWords}
                    onChange={(e) => setOptions({...options, minWords: Number(e.target.value)})}
                    className="bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold focus:outline-none focus:border-primary/50 focus:bg-surface transition-all text-center"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <label className="text-[11px] sm:text-xs font-semibold text-on-surface-variant px-1">Max Words</label>
                  <input 
                    type="number" 
                    value={options.maxWords}
                    onChange={(e) => setOptions({...options, maxWords: Number(e.target.value)})}
                    className="bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold focus:outline-none focus:border-primary/50 focus:bg-surface transition-all text-center"
                  />
                </div>
              </div>

              {/* Temperature */}
              <div className="flex flex-col gap-2 sm:gap-3 bg-surface-container p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] sm:text-xs font-bold text-on-surface">Độ sáng tạo (Temp)</label>
                  <span className="text-[10px] sm:text-xs bg-primary/20 text-primary font-mono px-1.5 sm:px-2 py-0.5 rounded-md font-bold">{options.temperature.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={options.temperature}
                  onChange={(e) => setOptions({...options, temperature: Number(e.target.value)})}
                  className="w-full accent-primary h-1.5 bg-surface-container-highest rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-90 [&::-webkit-slider-thumb]:transition-transform cursor-pointer mt-2"
                />
              </div>

              {/* Force Retranslate */}
              <div className="flex items-center justify-between bg-surface-container p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-transparent">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-on-surface">Dịch lại toàn bộ</p>
                  <p className="text-[10px] sm:text-[11px] text-on-surface-variant font-medium mt-0.5">Tắt để chỉ dịch lỗi</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={options.forceRetranslate}
                    onChange={(e) => setOptions({...options, forceRetranslate: e.target.checked})}
                  />
                  <div className="w-10 h-6 sm:w-12 sm:h-7 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1a1a1a] after:border-black after:border after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-6 after:transition-all peer-checked:bg-primary peer-checked:after:bg-black"></div>
                </label>
              </div>
              
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="absolute bottom-0 left-0 w-full p-3 sm:p-4 bg-surface-container border-t border-outline-variant/30 pb-safe z-20">
          <button 
            onClick={handleSubmit}
            className="w-full py-3 sm:py-4 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold font-sans flex items-center justify-center gap-2 hover:bg-primary-fixed active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
          >
            <Sparkles size={18} className="fill-black/50 sm:w-5 sm:h-5" />
            {activeTab === 'current' ? 'Dịch Ngay Chương Này' : 
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
      className={`flex-1 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-bold rounded-lg transition-all duration-200 ${active ? 'bg-surface text-primary shadow-sm border border-outline-variant/10' : 'text-on-surface-variant hover:text-on-surface transparent border border-transparent'}`}
    >
      {children}
    </button>
  );
}
