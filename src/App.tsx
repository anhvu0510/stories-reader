import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { ToastContainer } from './components/Toast';
import { GlobalSettingsSheet } from './components/GlobalSettingsSheet';
import { BookOpen } from 'lucide-react';

export type AppView = 
  | { type: 'library', tab?: 'books' | 'history' | 'ai' }
  | { type: 'book', bookId: string, filterState?: 'all' | 'PENDING', rootTab: string }
  | { type: 'reader', bookId: string, chapterId: string, rootTab: string };

function BookProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId , rootTab } = useParams<{ bookId: string, rootTab: string }>();
  const [searchParams] = useSearchParams();
  if (!bookId) return null;
  const filterState = searchParams.get('filterState') === 'PENDING' ? 'PENDING' : 'all';
  return <ChapterListScreen bookId={bookId} filterState={filterState} rootTab={rootTab} onNavigate={onNavigate} />;
}

function ReaderProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId, chapterId, rootTab } = useParams<{ bookId: string, chapterId: string, rootTab: string }>();
  if (!bookId || !chapterId) return null;
  return <ReaderScreen bookId={bookId} chapterId={chapterId} rootTab={rootTab} onNavigate={onNavigate} />;
}

function AppContent() {
  const navigate = useNavigate();

  const handleNavigate = (view: AppView) => {
    if (view.type === 'library') {
      navigate(`/${view.tab ? `?tab=${view.tab}` : ''}`);
    } else if (view.type === 'book') {
      navigate(`/${view.rootTab ?? 'NONE'}/${view.bookId}${view.filterState === 'PENDING' ? '?filterState=PENDING' : ''}`);
    } else if (view.type === 'reader') {
      navigate(`/${view.rootTab ?? 'NONE'}/${view.bookId}/${view.chapterId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      <Routes>
        <Route path="/" element={<LibraryScreen onNavigate={handleNavigate} />} />
        <Route path="/:rootTab/:bookId" element={<BookProxy onNavigate={handleNavigate} />} />
        <Route path="/:rootTab/:bookId/:chapterId" element={<ReaderProxy onNavigate={handleNavigate} />} />
      </Routes>
    </div>
  );
}

function ApplicationGate({ children }: { children: React.ReactNode }) {
  const [showSettings, setShowSettings] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let hasDomains = false;
    
    try {
      const domainsData = localStorage.getItem('API_DOMAINS_CONFIG');
      if (domainsData) {
        const parsed = JSON.parse(domainsData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasDomains = true;
        }
      }
    } catch {}

    const legacyDomain = localStorage.getItem('API_DOMAIN_CONFIG');
    if (legacyDomain) hasDomains = true;
    
    if (!hasDomains) {
      setShowSettings(true);
    }
  }, []);

  const handleSave = async () => {
    if (domainInput.trim()) {
      setIsTesting(true);
      const newDomain = {
        id: Date.now().toString(),
        name: nameInput.trim() || 'Server Mặc định',
        url: domainInput.trim()
      };
      
      try {
        const res = await fetch(`${newDomain.url}/api/quota`).catch(() => null);
        if (!res || !res.ok) {
          window.dispatchEvent(new CustomEvent('app-toast', { 
            detail: { message: 'Máy chủ không phản hồi mong đợi. Vẫn tiếp tục lưu!', type: 'error' }
          }));
        }
      } catch {
        window.dispatchEvent(new CustomEvent('app-toast', { 
          detail: { message: 'Máy chủ không phản hồi mong đợi. Vẫn tiếp tục lưu!', type: 'error' }
        }));
      } finally {
        setIsTesting(false);
        localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify([newDomain]));
        localStorage.setItem('ACTIVE_API_DOMAIN_ID', newDomain.id);
        setShowSettings(false);
        window.location.reload();
      }
    }
  };

  return (
    <>
      {!showSettings ? children : (
        <div className="min-h-screen bg-surface-container-lowest flex flex-col justify-center p-5 sm:p-6 font-sans relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[30%] bg-[#b47a18]/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="w-full max-w-[400px] mx-auto flex flex-col gap-8 relative z-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mb-2 shadow-sm ring-1 ring-primary/20">
                <BookOpen size={36} strokeWidth={2.5} className="drop-shadow-sm" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight mb-2">Stories Reader</h1>
                <p className="text-[14px] sm:text-[15px] text-on-surface-variant max-w-[280px] mx-auto leading-relaxed">
                  Thiết lập máy chủ trích xuất và đọc truyện của bạn để bắt đầu.
                </p>
              </div>
            </div>
            
            <div className="bg-surface p-6 rounded-[28px] shadow-sm ring-1 ring-outline-variant/20 flex flex-col gap-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                    Tên máy chủ <span className="normal-case font-normal opacity-70">(Tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="VD: Server Cá Nhân"
                    className="w-full bg-surface-container-highest/20 text-on-surface px-4 py-4 rounded-2xl border border-outline-variant/30 focus:border-primary focus:bg-surface-container-lowest outline-none transition-all text-[15px] placeholder:text-on-surface-variant/40"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 flex justify-between">
                    <span>URL Máy chủ <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="url"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="https://api.domain.com"
                    className="w-full bg-surface-container-highest/20 text-on-surface px-4 py-4 rounded-2xl border border-outline-variant/30 focus:border-primary focus:bg-surface-container-lowest outline-none transition-all text-[15px] placeholder:text-on-surface-variant/40"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
              </div>
              
              <button
                onClick={handleSave}
                disabled={!domainInput.trim() || isTesting}
                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2 shadow-sm text-[16px] active:scale-[0.98]"
              >
                {isTesting ? (
                  <>
                    <div className="w-5 h-5 border-[2.5px] border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                    Đang kết nối...
                  </>
                ) : (
                  <>Bắt đầu trải nghiệm</>
                )}
              </button>
            </div>
            
            <p className="text-center text-[12px] text-on-surface-variant/70 font-medium px-4 leading-relaxed">
              Bạn có thể quản lý đa máy chủ trong phần cài đặt sau này.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function GlobalEventWrapper({ children }: { children: React.ReactNode }) {
  const [showSettings, setShowSettings] = useState(false);
  
  useEffect(() => {
    const handleOpenSettings = ((e: CustomEvent) => {
      if (e.detail?.tab === 'servers') {
        setShowSettings(true);
      }
    }) as EventListener;
    
    window.addEventListener('open-global-settings', handleOpenSettings);
    return () => window.removeEventListener('open-global-settings', handleOpenSettings);
  }, []);
  
  return (
    <>
      {children}
      {showSettings && <GlobalSettingsSheet onClose={() => setShowSettings(false)} initialTab="servers" />}
    </>
  );
}

export default function App() {
  return (
    <ReaderProvider>
      <ApplicationGate>
        <HashRouter>
          <GlobalEventWrapper>
            <AppContent />
          </GlobalEventWrapper>
          <ToastContainer />
        </HashRouter>
      </ApplicationGate>
    </ReaderProvider>
  );
}

