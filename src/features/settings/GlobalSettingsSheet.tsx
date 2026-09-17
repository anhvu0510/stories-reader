import React from 'react';
import { X, Server, BookOpen, Volume2, Sparkles, RefreshCw } from 'lucide-react';
import { useModalStore } from '../../stores/useModalStore';
import { BottomSheet } from '../../components/BottomSheet';
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

  const tabs = [
    { id: 'servers', label: 'Server API', icon: Server },
    { id: 'reader', label: 'Chế độ Đọc', icon: BookOpen },
    { id: 'voice', label: 'Giọng đọc TTS', icon: Volume2 },
    { id: 'translation', label: 'Dịch AI', icon: Sparkles },
    { id: 'replacements', label: 'Thay thế từ', icon: RefreshCw },
  ] as const;

  return (
    <BottomSheet
      isOpen={isSettingsOpen}
      onClose={closeSettings}
      ariaLabel="Cấu hình Hệ thống"
      maxHeight="h-[680px] max-h-[88dvh]"
      showDragHandle={false}
    >
      {/* Top Header & Tab Capsule (100% unified theme header) */}
      <div className="pt-2.5 px-3.5 pb-2 border-b border-outline-variant/30 space-y-2 flex-shrink-0 bg-transparent relative z-20">
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-on-surface-variant/30 mx-auto flex-shrink-0" />

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
            className="p-1 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all active:scale-95"
          >
            <X size={15} />
          </button>
        </div>

        {/* Smooth Capsule Container */}
        <div className="flex items-center justify-between gap-1 p-1 bg-surface-container-high border border-outline-variant/40 rounded-2xl w-full">
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
                    ? 'px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/60 text-primary font-black shadow-xs gap-1.5 flex-1'
                    : 'p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 hide-scrollbar no-scrollbar relative z-20">
        {activeSettingsTab === 'servers' && <ServerTab />}
        {activeSettingsTab === 'reader' && <ReaderSettingsTab />}
        {activeSettingsTab === 'voice' && <VoiceSettingsTab />}
        {activeSettingsTab === 'translation' && (
          <AISettingsTab bookId={currentBookId} chapterId={currentChapterId} />
        )}
        {activeSettingsTab === 'replacements' && <ReplacementsTab />}
      </div>
    </BottomSheet>
  );
}

