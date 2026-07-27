import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ChapterListScreen } from './features/chapter-list/ChapterListScreen';
import { ReaderScreen } from './features/reader/ReaderScreen';
import { ToastContainer } from './components/Toast';
import { GlobalDownloadProgress } from './components/GlobalDownloadProgress';
import { useAppStore } from './stores/useAppStore';
import { useModalStore } from './stores/useModalStore';
import { useToastStore } from './stores/useToastStore';
import { useReaderConfigStore } from './stores/useReaderConfigStore';
import { BookOpen } from 'lucide-react';

function AppContent() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-on-background flex flex-col box-border">
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/book/:bookId" element={<ChapterListScreen />} />
        <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
      </Routes>
    </div>
  );
}

function ApplicationGate({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    useAppStore.getState().loadAppConfig();
    useReaderConfigStore.getState().fetchServerConfig();

    const checkConnection = async () => {
      const isOffline = useAppStore.getState().isOfflineMode;
      const domain = useAppStore.getState().activeDomain;

      if (isOffline) {
        setIsInitializing(false);
        return;
      }

      if (!domain || !domain.url) {
        setShowSettings(true);
        setIsInitializing(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(domain.url, {
          signal: controller.signal,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          setShowSettings(false);
        } else {
          useToastStore.getState().showToast('Máy chủ mặc định không phản hồi đúng định dạng.', 'error');
          useModalStore.getState().openSettings('servers');
        }
      } catch {
        useToastStore.getState().showToast('Không thể kết nối với máy chủ.', 'error');
        useModalStore.getState().openSettings('servers');
      } finally {
        setIsInitializing(false);
      }
    };

    checkConnection();
  }, []);

  const handleSave = async () => {
    if (domainInput.trim()) {
      setIsTesting(true);
      try {
        const res = await fetch(domainInput.trim(), {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        }).catch(() => null);

        if (!res || !res.ok) {
          useToastStore.getState().showToast('Máy chủ không phản hồi hoặc URL không hợp lệ.', 'error');
          setIsTesting(false);
          return;
        }

        useAppStore.getState().addDomain({
          id: Date.now().toString(),
          name: nameInput.trim() || 'Server Mặc định',
          url: domainInput.trim(),
        });
        setShowSettings(false);
        window.location.reload();
      } catch {
        useToastStore.getState().showToast('Có lỗi xảy ra khi lưu máy chủ.', 'error');
      } finally {
        setIsTesting(false);
      }
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans gap-6">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mb-6 shadow-sm ring-1 ring-primary/20 relative">
            <BookOpen size={24} className="animate-pulse" />
            <div className="absolute inset-0 border-2 border-primary/30 rounded-3xl animate-ping opacity-50" />
          </div>
          <div className="text-on-surface-variant font-medium text-[15px] animate-pulse">Đang kết nối máy chủ...</div>
        </div>

        <button
          onClick={() => {
            useAppStore.getState().setOfflineMode(true);
            window.location.reload();
          }}
          className="mt-8 px-5 py-2.5 rounded-full bg-surface-container border border-outline-variant/30 text-[14px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
        >
          Vào chế độ Ngoại tuyến
        </button>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex flex-col justify-center p-5 sm:p-6 font-sans relative overflow-hidden">
        <div className="w-full max-w-[400px] mx-auto flex flex-col gap-8 relative z-10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mb-2 shadow-sm ring-1 ring-primary/20">
              <BookOpen size={28} strokeWidth={2.5} className="drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight mb-2">Stories Reader</h1>
              <p className="text-[14px] text-on-surface-variant max-w-[280px] mx-auto leading-relaxed">
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
                  placeholder="Ví dụ: Server Nhà, Ngrok..."
                  className="w-full h-12 px-4 rounded-2xl bg-surface-container-high border border-transparent focus:border-primary/50 text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">
                  URL Máy chủ API <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-12 px-4 rounded-2xl bg-surface-container-high border border-transparent focus:border-primary/50 text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isTesting || !domainInput.trim()}
              className="w-full h-12 rounded-2xl bg-primary text-on-primary font-bold text-[14px] shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isTesting ? 'Đang kiểm tra...' : 'Kết nối & Bắt đầu'}
            </button>

            <button
              onClick={() => {
                useAppStore.getState().setOfflineMode(true);
                setShowSettings(false);
              }}
              className="w-full h-10 rounded-2xl bg-surface-container border border-outline-variant/30 text-on-surface-variant font-semibold text-[13px] hover:bg-surface-container-high transition-all"
            >
              Hoặc vào Chế độ Ngoại tuyến (Offline Mode)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <ApplicationGate>
        <AppContent />
        <GlobalDownloadProgress />
        <ToastContainer />
      </ApplicationGate>
    </Router>
  );
}
