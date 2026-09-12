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
    <header className="sticky top-0 z-30 bg-black/10 dark:bg-black/15 backdrop-blur-[2px] border-b border-blue-500/30 dark:border-blue-400/25 shadow-[0_8px_24px_rgba(0,0,0,0.4),_inset_0_-1px_0.5px_0_rgba(0,0,0,0.4)] px-3.5 py-3 space-y-2.5 w-full max-w-md mx-auto overflow-x-hidden box-border transition-colors duration-200">
      {/* Top Title Bar & Essential Shortcut Buttons Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Sleek 3D Squircle Icon Container */}
          <div className="w-9 h-9 rounded-[14px] bg-gradient-to-b from-amber-400/20 via-slate-900 to-slate-950 border border-amber-400/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),_0_4px_12px_rgba(0,0,0,0.4)] flex items-center justify-center text-amber-400 shrink-0">
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
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                : 'bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-on-surface-variant hover:text-on-surface hover:bg-white/10 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]'
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

      {/* Search Input, Sort & Tag Filter Row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={onSubmitSearch}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer"
            title="Bấm để tìm kiếm"
          >
            <Search size={14} />
          </button>
          <input
            type="text"
            placeholder="Tìm kiếm truyện chữ (nhấn Enter)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSubmitSearch) {
                onSubmitSearch();
              }
            }}
            className="w-full pl-9 pr-8 py-2 rounded-2xl bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium transition-all shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-all"
              title="Xóa từ khóa"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort Button with Active Highlight */}
        {onOpenSort && (
          <button
            type="button"
            onClick={onOpenSort}
            className={`relative p-2 rounded-2xl border transition-all active:scale-95 flex items-center justify-center shrink-0 shadow-xs ${
              isCustomSortActive
                ? 'bg-primary/15 text-primary border-primary/50 shadow-sm'
                : 'bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-on-surface-variant hover:text-primary hover:border-primary/40 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]'
            }`}
            title="Sắp xếp danh sách"
            aria-label="Sắp xếp danh sách"
            data-testid="sort-trigger-btn"
          >
            <ArrowUpDown size={15} />
            {isCustomSortActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-surface" />
            )}
          </button>
        )}

        {/* Tag Filter Button with Active Badge */}
        <button
          type="button"
          onClick={onOpenTagFilter}
          className={`relative p-2 rounded-2xl border transition-all active:scale-95 flex items-center justify-center shrink-0 shadow-xs ${
            activeTagsCount > 0
              ? 'bg-primary text-on-primary border-primary shadow-sm'
              : 'bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-on-surface-variant hover:text-primary hover:border-primary/40 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)]'
          }`}
          title="Lọc theo Thể loại & Tags"
          aria-label="Lọc theo Thể loại & Tags"
          data-testid="tag-filter-trigger-btn"
        >
          <Tag size={15} />
          {activeTagsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 h-4 rounded-full bg-error text-on-error text-[9px] font-bold font-mono flex items-center justify-center border-2 border-surface">
              {activeTagsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
