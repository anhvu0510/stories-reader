import React from 'react';
import { X, Server, BookOpen, Volume2, Sparkles, RefreshCw } from 'lucide-react';
import { useModalStore } from '../../stores/useModalStore';
import { ServerTab } from './components/ServerTab';
import { ReaderSettingsTab } from './components/ReaderSettingsTab';
import { VoiceSettingsTab } from './components/VoiceSettingsTab';
import { AISettingsTab } from './components/AISettingsTab';
import { ReplacementsTab } from './components/ReplacementsTab';

interface GlobalSettingsSheetProps {
  currentBookId?: string;
  currentChapterId?: string;
}

export function GlobalSettingsSheet({
  currentBookId,
  currentChapterId,
}: GlobalSettingsSheetProps) {
  const { isSettingsOpen, activeSettingsTab, closeSettings, setSettingsTab } =
    useModalStore();

  if (!isSettingsOpen) return null;

  const tabs = [
    { id: 'servers', label: 'Server API', icon: Server },
    { id: 'reader', label: 'Chế độ Đọc', icon: BookOpen },
    /* READ ALOUD (TTS) TEMPORARILY DISABLED
    { id: 'voice', label: 'Giọng đọc TTS', icon: Volume2 },
    */
    { id: 'translation', label: 'Dịch AI', icon: Sparkles },
    { id: 'replacements', label: 'Thay thế từ', icon: RefreshCw },
  ] as const;

  return (
    <div className="fixed inset-0 z-[90000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      {/* Backdrop click to close */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={closeSettings} />

      {/* STABLE THEME-SYNCHRONIZED BOTTOM SHEET */}
      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[32px] border-t border-outline-variant/30 shadow-2xl h-[76vh] max-h-[88dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Ambient Top Glow Effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-28 bg-primary/10 blur-3xl pointer-events-none rounded-full" />

        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto my-2.5 flex-shrink-0 relative z-20" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/80 backdrop-blur-md flex-shrink-0 relative z-20">
          <div>
            <h2 className="text-base font-black text-on-surface tracking-tight flex items-center gap-2">
              Cấu hình Hệ thống
            </h2>
            <p className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider">
              Settings & Preferences
            </p>
          </div>
          <button
            onClick={closeSettings}
            className="p-2 rounded-full bg-surface-container-high border border-outline-variant/30 hover:bg-surface text-on-surface-variant hover:text-on-surface transition-all active:scale-95 shadow-sm"
          >
            <X size={16} />
          </button>
        </div>

        {/* Smooth Capsule Container: Active Tab = Icon + Text, Inactive Tabs = Icon Only */}
        <div className="px-4 py-2.5 bg-surface-container-low/90 border-b border-outline-variant/20 flex-shrink-0 relative z-20">
          <div className="flex items-center justify-between gap-1 p-1 bg-surface-container-high/80 border border-outline-variant/30 rounded-2xl w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSettingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id as any)}
                  title={tab.label}
                  className={`transition-all duration-300 flex items-center justify-center active:scale-95 ${
                    isActive
                      ? 'px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-extrabold shadow-sm gap-1.5 flex-1'
                      : 'p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-on-primary' : 'text-primary'} />
                  {isActive && (
                    <span className="text-xs tracking-tight font-extrabold whitespace-nowrap animate-in fade-in duration-200">
                      {tab.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 no-scrollbar relative z-20">
          {activeSettingsTab === 'servers' && <ServerTab />}
          {activeSettingsTab === 'reader' && <ReaderSettingsTab />}
          {activeSettingsTab === 'voice' && <VoiceSettingsTab />}
          {activeSettingsTab === 'translation' && (
            <AISettingsTab bookId={currentBookId} chapterId={currentChapterId} />
          )}
          {activeSettingsTab === 'replacements' && <ReplacementsTab />}
        </div>
      </div>
    </div>
  );
}
