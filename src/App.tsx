import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { ToastContainer } from './components/Toast';
import { GlobalSettingsSheet } from './components/GlobalSettingsSheet';
import { BookOpen } from 'lucide-react';

function AppContent() {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/book/:bookId" element={<ChapterListScreen />} />
        <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
      </Routes>
    </div>
  );
}

function ApplicationGate({ children }: { children: React.ReactNode }) {
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      let activeDomainUrl = '';
      
      try {
        const domainsData = localStorage.getItem('API_DOMAINS_CONFIG');
        const activeDomainId = localStorage.getItem('ACTIVE_API_DOMAIN_ID');
        if (domainsData) {
          const parsed = JSON.parse(domainsData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const activeDomain = parsed.find(d => d.id === activeDomainId) || parsed[0];
            activeDomainUrl = activeDomain.url;
          }
        }
      } catch {}

      if (!activeDomainUrl) {
        const legacyDomain = localStorage.getItem('API_DOMAIN_CONFIG');
        if (legacyDomain) {
          activeDomainUrl = legacyDomain;
        }
      }
      
      if (!activeDomainUrl) {
        setShowSettings(true);
        setIsInitializing(false);
        return;
      }

      // Check connection
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${activeDomainUrl}/api/stories/setting/stories.ui.domain`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          try {
            const data = await res.json();
            const serverName = typeof data === 'string' ? data : (data?.name || data?.value || data?.title);
            if (serverName && typeof serverName === 'string') {
              const domainsData = localStorage.getItem('API_DOMAINS_CONFIG');
              if (domainsData) {
                let currentDomains = JSON.parse(domainsData);
                if (Array.isArray(currentDomains)) {
                  let updated = false;
                  currentDomains = currentDomains.map((d: any) => {
                    if (d.url === activeDomainUrl && (d.name === 'Server Mặc định' || !d.name)) {
                      d.name = serverName;
                      updated = true;
                    }
                    return d;
                  });
                  if (updated) localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify(currentDomains));
                }
              }
            }
          } catch(e) {}
          setShowSettings(false);
        } else {
          // If they fail to connect to activeDomainUrl but it exists, open the server switch setting.
          setShowSettings(false);
          window.dispatchEvent(new CustomEvent('app-toast', { 
            detail: { message: 'Máy chủ mặc định không phản hồi. Vui lòng chọn máy chủ khác.', type: 'error' }
          }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { tab: 'servers' } }));
          }, 500);
        }
      } catch (err) {
        // Network error or timeout -> force showing setting switch options
        setShowSettings(false);
        window.dispatchEvent(new CustomEvent('app-toast', { 
          detail: { message: 'Không thể kết nối với máy chủ.', type: 'error' }
        }));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { tab: 'servers' } }));
        }, 500);
      } finally {
        setIsInitializing(false);
      }
    };

    checkConnection();
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
        let currentDomains = [];
        try {
          const domainsData = localStorage.getItem('API_DOMAINS_CONFIG');
          if (domainsData) {
            currentDomains = JSON.parse(domainsData);
            if (!Array.isArray(currentDomains)) currentDomains = [];
          }
        } catch {}

        const res = await fetch(`${newDomain.url}/api/stories/setting/stories.ui.domain`).catch(() => null);
        if (!res || !res.ok) {
          window.dispatchEvent(new CustomEvent('app-toast', { 
            detail: { message: 'Máy chủ không phản hồi hoặc URL không hợp lệ.', type: 'error' }
          }));
          setIsTesting(false);
          return; // Failed to validate -> abort saving!
        } else {
          try {
            const data = await res.json();
            const serverName = typeof data === 'string' ? data : (data?.name || data?.value || data?.title);
            if (serverName && typeof serverName === 'string' && (!nameInput.trim() || nameInput.trim() === 'Server Mặc định')) {
              newDomain.name = serverName;
            }
          } catch(e) {}
        }

        currentDomains.push(newDomain);
        localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify(currentDomains));
        localStorage.setItem('ACTIVE_API_DOMAIN_ID', newDomain.id);
        setShowSettings(false);
        window.location.reload();
      } catch {
        window.dispatchEvent(new CustomEvent('app-toast', { 
          detail: { message: 'Có lỗi xảy ra khi lưu máy chủ.', type: 'error' }
        }));
      } finally {
        setIsTesting(false);
      }
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mb-6 shadow-sm ring-1 ring-primary/20 relative">
          <BookOpen size={28} className="animate-pulse" />
          <div className="absolute inset-0 border-2 border-primary/30 rounded-3xl animate-ping opacity-50" />
        </div>
        <div className="text-on-surface-variant font-medium text-[15px] animate-pulse">Đang kết nối máy chủ...</div>
      </div>
    );
  }

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
        <Router>
          <GlobalEventWrapper>
            <AppContent />
          </GlobalEventWrapper>
          <ToastContainer />
        </Router>
      </ApplicationGate>
    </ReaderProvider>
  );
}

