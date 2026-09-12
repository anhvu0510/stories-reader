import React from 'react';
import { X, Server, BookOpen, Volume2, Sparkles, RefreshCw } from 'lucide-react';
import { useModalStore } from '../../stores/useModalStore';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
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

  useBodyScrollLock(isSettingsOpen);

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
    <div className="fixed inset-0 z-[99000] bg-black/35 backdrop-blur-[2px] flex justify-center items-end p-0 overflow-x-hidden overscroll-none box-border">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={closeSettings} onTouchMove={(e) => e.preventDefault()} />

      {/* STABLE FIXED-HEIGHT THEME-SYNCHRONIZED BOTTOM SHEET */}
      <div className="relative z-10 bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full max-w-md mx-auto rounded-t-[32px] border-t sm:border border-white/20 dark:border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1.5px_1.5px_0_rgba(255,255,255,0.4)] h-[720px] max-h-[88dvh] flex flex-col overflow-hidden box-border transform-gpu transition-colors duration-200">
        {/* Ambient Top Glow Effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-28 bg-primary/10 blur-3xl pointer-events-none rounded-full" />

        {/* Top Header & Tab Capsule (100% unified glass header) */}
        <div className="pt-2.5 px-3.5 pb-2 border-b border-white/10 space-y-2 flex-shrink-0 bg-transparent relative z-20">
          {/* Drag Handle */}
          <div className="w-10 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto flex-shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-black text-on-surface tracking-tight flex items-center gap-2">
                Cấu hình Hệ thống
              </h2>
              <p className="text-[9px] font-mono text-on-surface-variant/70 uppercase tracking-wider">
                Settings & Preferences
              </p>
            </div>
            <button
              onClick={closeSettings}
              className="p-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all active:scale-95"
            >
              <X size={15} />
            </button>
          </div>

          {/* Smooth Capsule Container */}
          <div className="flex items-center justify-between gap-1 p-1 bg-white/10 border border-white/15 rounded-2xl w-full">
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
                      ? 'px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary font-black shadow-[0_2px_8px_var(--primary)] gap-1.5 flex-1'
                      : 'p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-primary' : 'text-primary/70'} />
                  {isActive && (
                    <span className="text-xs tracking-tight font-black whitespace-nowrap animate-in fade-in duration-200">
                      {tab.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 no-scrollbar relative z-20">
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
