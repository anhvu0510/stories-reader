import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { ToastContainer } from './components/Toast';
import { GlobalSettingsSheet } from './components/GlobalSettingsSheet';

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
  const [domainInput, setDomainInput] = useState('');

  useEffect(() => {
    const savedDomain = localStorage.getItem('API_DOMAIN_CONFIG');
    if (!savedDomain) {
      setShowSettings(true);
    } else {
      setDomainInput(savedDomain);
    }
  }, []);

  const handleSave = () => {
    if (domainInput.trim()) {
      localStorage.setItem('API_DOMAIN_CONFIG', domainInput.trim());
      setShowSettings(false);
      window.location.reload();
    }
  };

  return (
    <>
      {!showSettings ? children : (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="bg-surface p-6 sm:p-8 rounded-2xl border border-outline-variant/30 shadow-lg w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-primary mb-2">Chào mừng đến với Reader</h1>
              <p className="text-on-surface-variant text-sm">Vui lòng cấu hình URL API hệ thống để tiếp tục sử dụng.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold tracking-wide text-on-surface-variant mb-2">
                  URL API CỦA HỆ THỐNG
                </label>
                <input
                  type="url"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://api.example.com"
                  className="w-full bg-surface-container-highest text-on-surface px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={!domainInput.trim()}
                className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Lưu và Bắt đầu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ReaderProvider>
      <ApplicationGate>
        <HashRouter>
          <AppContent />
          <ToastContainer />
        </HashRouter>
      </ApplicationGate>
    </ReaderProvider>
  );
}

