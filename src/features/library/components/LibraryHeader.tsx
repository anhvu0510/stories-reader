import React from 'react';
import { Search, Wifi, WifiOff, Settings, BookOpenCheck, X } from 'lucide-react';
import { useAppStore } from '../../../stores/useAppStore';

interface LibraryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings: () => void;
}

export function LibraryHeader({
  searchQuery,
  onSearchChange,
  onOpenSettings,
}: LibraryHeaderProps) {
  const { isOfflineMode, setOfflineMode } = useAppStore();

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-3.5 py-3 space-y-2.5 w-full max-w-md mx-auto overflow-x-hidden box-border transition-colors duration-200">
      {/* Top Title Bar & Essential Shortcut Buttons Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-xs shrink-0">
            <BookOpenCheck size={18} />
          </div>
          <div>
            <h1 className="text-base font-black text-on-surface tracking-tight flex items-center gap-1.5 leading-none">
              Stories Reader
            </h1>
            <p className="text-[9.5px] font-mono text-on-surface-variant/70 uppercase tracking-wider mt-0.5">Mobile Edition</p>
          </div>
        </div>

        {/* Essential Action Buttons Row: Online/Offline & System Settings */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Online / Offline Mode Toggle Icon */}
          <button
            onClick={() => setOfflineMode(!isOfflineMode)}
            className={`p-2 rounded-full border transition-all active:scale-95 shadow-sm ${
              isOfflineMode
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface'
            }`}
            title={isOfflineMode ? 'Đang ở chế độ Ngoại tuyến (Bấm để chuyển Online)' : 'Đang ở chế độ Trực tuyến (Bấm để chuyển Offline)'}
          >
            {isOfflineMode ? <WifiOff size={15} /> : <Wifi size={15} />}
          </button>

          {/* Global System Settings Icon */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-surface transition-all active:scale-95 shadow-sm"
            title="Cài đặt Hệ thống"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
        <input
          type="text"
          placeholder="Tìm kiếm truyện chữ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-all"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </header>
  );
}
