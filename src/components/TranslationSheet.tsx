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
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-background text-on-background w-full rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl border-t border-surface-variant z-10 overflow-hidden">
        
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0 pt-4 px-4 pb-2 border-b border-surface-variant/50 bg-surface">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full mx-auto mb-4"></div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-serif text-xl font-bold flex items-center gap-2 text-on-surface">
              <Languages size={22} className="text-primary" />
              Dịch thuật AI
            </h2>
            <button onClick={onClose} className="p-2 bg-surface-container rounded-full text-on-surface-variant hover:text-on-surface">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex gap-2 mt-4 bg-surface-container p-1 rounded-lg">
            <TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')}>Hiện tại</TabButton>
            <TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>Nhiều chương</TabButton>
            <TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>Truyện</TabButton>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-6 pb-24">
          
          {/* Tab Content */}
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/30 p-4">
            {activeTab === 'current' && (
              <div className="text-center py-4">
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold mb-2">Chương đang mở</p>
                <h3 className="font-serif text-lg font-bold text-primary">{currentChapterName || 'Chưa chọn chương'}</h3>
                <p className="text-sm text-on-surface-variant mt-1">{currentBookName}</p>
              </div>
            )}

            {activeTab === 'batch_chapter' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-on-surface-variant font-semibold uppercase">Chọn chương ({selectedChapters.size}/{chapters.length})</p>
                  <button 
                    onClick={() => setSelectedChapters(new Set(chapters.filter(c => c.state === 'FAILED').map(c => c.chapterId)))}
                    className="text-xs text-primary font-medium"
                  >
                    Chọn chưa dịch
                  </button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto hide-scrollbar flex flex-col gap-1 border border-outline-variant/20 rounded-lg p-1 bg-surface">
                  {[...chapters].sort((a, b) => {
                    const aH = selectedChapters.has(a.chapterId) ? 1 : 0;
                    const bH = selectedChapters.has(b.chapterId) ? 1 : 0;
                    if (aH !== bH) return bH - aH;
                    return a.chapterNumber - b.chapterNumber;
                  }).map(chap => (
                    <div 
                      key={chap.chapterId} 
                      onClick={() => toggleChapter(chap.chapterId)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedChapters.has(chap.chapterId) ? 'bg-primary/10' : 'hover:bg-surface-container'}`}
                    >
                      <button className="text-on-surface-variant">
                        {selectedChapters.has(chap.chapterId) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                      </button>
                      <span className="text-sm flex-1 truncate">Chương {chap.chapterNumber}: {chap.title}</span>
                      {chap.state === 'FAILED' && <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-bold">CHỜ DỊCH</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'story' && (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
                  <input 
                    type="text" 
                    placeholder="Tìm truyện..." 
                    value={searchBook}
                    onChange={(e) => setSearchBook(e.target.value)}
                    className="w-full bg-surface border border-outline-variant/50 rounded-lg py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto hide-scrollbar flex flex-col gap-1 border border-outline-variant/20 rounded-lg p-1 bg-surface">
                  {books.filter(b => b.bookName.toLowerCase().includes(searchBook.toLowerCase())).map(book => (
                    <div 
                      key={book.bookId} 
                      onClick={() => toggleBook(book.bookId)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedBooks.has(book.bookId) ? 'bg-primary/10' : 'hover:bg-surface-container'}`}
                    >
                      <button className="text-on-surface-variant">
                        {selectedBooks.has(book.bookId) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                      </button>
                      <span className="text-sm flex-1 truncate">{book.bookName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Global Config */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={14} />
              Cấu hình chung
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Model Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-on-surface">Model AI</label>
                <select 
                  value={options.model}
                  onChange={(e) => setOptions({...options, model: e.target.value as Model})}
                  className="bg-surface-container border border-outline-variant/50 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary appearance-none"
                >
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Nhanh, Rẻ)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Cân bằng)</option>
                  <option value="gemini-pro">Gemini Pro (Chất lượng cao)</option>
                </select>
              </div>

              {/* Batch Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface">Min Words</label>
                  <input 
                    type="number" 
                    value={options.minWords}
                    onChange={(e) => setOptions({...options, minWords: Number(e.target.value)})}
                    className="bg-surface-container border border-outline-variant/50 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface">Max Words</label>
                  <input 
                    type="number" 
                    value={options.maxWords}
                    onChange={(e) => setOptions({...options, maxWords: Number(e.target.value)})}
                    className="bg-surface-container border border-outline-variant/50 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Temperature */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-on-surface">Độ sáng tạo (Temperature)</label>
                  <span className="text-xs text-primary font-mono">{options.temperature.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={options.temperature}
                  onChange={(e) => setOptions({...options, temperature: Number(e.target.value)})}
                  className="w-full accent-primary bg-surface-container-highest h-1 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                />
              </div>

              {/* Force Retranslate */}
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
                <div>
                  <p className="text-sm font-medium">Dịch lại toàn bộ</p>
                  <p className="text-[10px] text-on-surface-variant">Tắt để chỉ dịch phần lỗi</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={options.forceRetranslate}
                    onChange={(e) => setOptions({...options, forceRetranslate: e.target.checked})}
                  />
                  <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-on-primary"></div>
                </label>
              </div>
              
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="absolute bottom-0 left-0 w-full p-4 bg-background border-t border-surface-variant/50 pb-safe-bottom">
          <button 
            onClick={handleSubmit}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold font-sans flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors"
          >
            <Sparkles size={18} />
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
      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${active ? 'bg-surface-dim text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
    >
      {children}
    </button>
  );
}
