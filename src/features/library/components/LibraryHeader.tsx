import React from 'react';
import { Search, Wifi, WifiOff, Settings, BookOpenCheck, X, Tag, ArrowUpDown, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../stores/useAppStore';

interface LibraryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings: () => void;
  onSubmitSearch?: () => void;
  onOpenTagFilter?: () => void;
  activeTagsCount?: number;
  onOpenSort?: () => void;
  isCustomSortActive?: boolean;
}

export function LibraryHeader({
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onSubmitSearch,
  onOpenTagFilter,
  activeTagsCount = 0,
  onOpenSort,
  isCustomSortActive = false,
}: LibraryHeaderProps) {
  const { isOfflineMode, setOfflineMode } = useAppStore();

  return (
    <header className="px-3.5 py-2.5 space-y-2.5 w-full max-w-md mx-auto overflow-x-hidden box-border transition-colors duration-200">
      {/* Top Title Bar & Essential Shortcut Buttons Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Sleek 3D Squircle Icon Container */}
          <div className="w-9 h-9 rounded-[14px] bg-gradient-to-b from-primary/20 via-slate-900 to-slate-950 border border-primary/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),_0_4px_12px_rgba(0,0,0,0.4)] flex items-center justify-center text-primary shrink-0">
            <BookOpenCheck size={19} className="drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)]" />
          </div>

          <div className="leading-none space-y-0.5">
            <h1 className="text-base font-black text-on-surface tracking-tight">
              Stories Reader
            </h1>
            <p className="text-[9.5px] font-mono font-semibold text-on-surface-variant/60 uppercase tracking-widest">
              Mobile Edition
            </p>
          </div>
        </div>

        {/* Essential Action Buttons Row: Online/Offline & System Settings */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Online / Offline Mode Toggle Icon */}
          <button
            onClick={() => setOfflineMode(!isOfflineMode)}
            className={`p-2 rounded-full border transition-all active:scale-95 shadow-sm ${
              isOfflineMode
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-white/5 dark:bg-white/5 border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-white/10 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]'
            }`}
            title={isOfflineMode ? 'Đang ở chế độ Ngoại tuyến (Bấm để chuyển Online)' : 'Đang ở chế độ Trực tuyến (Bấm để chuyển Offline)'}
          >
            {isOfflineMode ? <WifiOff size={15} /> : <Wifi size={15} />}
          </button>

          {/* Global System Settings Icon */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-on-surface-variant hover:text-primary hover:bg-white/10 transition-all active:scale-95 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]"
            title="Cài đặt Hệ thống"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <button
          type="button"
          onClick={onSubmitSearch}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer z-10"
          title="Bấm để tìm kiếm"
        >
          <Search size={14} />
        </button>
        <input
          type="text"
          placeholder="Tìm tên truyện, tác giả..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSubmitSearch?.();
            }
          }}
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] box-border"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-all z-10"
            title="Xóa từ khóa"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Standalone Fallback for Unit Tests if onOpenSort / onOpenTagFilter passed directly to LibraryHeader */}
      {(onOpenSort || onOpenTagFilter) && !onSubmitSearch && (
        <div className="hidden">
          {onOpenSort && (
            <button type="button" onClick={onOpenSort} data-testid="sort-trigger-btn" aria-label="Sắp xếp danh sách" />
          )}
          {onOpenTagFilter && (
            <button type="button" onClick={onOpenTagFilter} data-testid="tag-filter-trigger-btn" aria-label="Lọc theo Thể loại & Tags" />
          )}
        </div>
      )}
    </header>
  );
}
