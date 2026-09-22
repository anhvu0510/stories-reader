import React, { memo } from 'react';
import { Home, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReaderHeaderProps {
  bookId: string;
  bookName?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  progress?: number;
  isVisible?: boolean;
  isTTSActive?: boolean;
  onToggleTTS?: () => void;
  onOpenHistory: () => void;
}

export const ReaderHeader = memo(function ReaderHeader({
  bookId,
  bookName,
  chapterNumber,
  chapterTitle,
  progress = 0,
  isVisible = true,
  isTTSActive = false,
  onToggleTTS,
  onOpenHistory,
}: ReaderHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] border-b border-white/25 dark:border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4)] px-3 py-2 w-full max-w-md mx-auto overflow-x-hidden box-border transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: Home Button (3D Compact Glass Sphere) */}
        <button
          onClick={() => navigate('/')}
          className="w-7 h-7 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 dark:from-white/15 dark:via-white/5 dark:to-black/25 border border-white/35 dark:border-white/25 text-on-surface hover:text-primary hover:from-white/25 hover:to-white/10 shadow-[0_3px_8px_rgba(0,0,0,0.35),_inset_0_1px_1px_0_rgba(255,255,255,0.45),_inset_0_-1px_1px_0_rgba(0,0,0,0.35)] active:translate-y-[0.5px] active:scale-90 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
          title="Về Thư viện"
          aria-label="Về Thư viện"
        >
          <Home size={14} strokeWidth={2.3} />
        </button>

        {/* Center: Book Name & Chapter Title (Centered) */}
        <div className="min-w-0 flex-1 text-center px-1">
          <p className="text-[10px] font-bold text-on-surface-variant/75 truncate tracking-tight text-center">
            {bookName || 'Đang tải...'}
          </p>
          <div className="mt-0.5 overflow-hidden w-full mx-auto max-w-[200px] sm:max-w-[250px]">
            <h2
              className="text-xs font-extrabold text-on-surface truncate tracking-tight text-center"
              title={chapterTitle}
            >
              {chapterTitle || ''}
            </h2>
          </div>
        </div>

        {/* Right: Actions (3D Compact Glass Spheres) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenHistory}
            className="w-7 h-7 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 dark:from-white/15 dark:via-white/5 dark:to-black/25 border border-white/35 dark:border-white/25 text-primary hover:from-white/25 hover:to-white/10 shadow-[0_3px_8px_rgba(0,0,0,0.35),_inset_0_1px_1px_0_rgba(255,255,255,0.45),_inset_0_-1px_1px_0_rgba(0,0,0,0.35)] active:translate-y-[0.5px] active:scale-90 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
            title="Lịch sử đọc gần đây"
            aria-label="Lịch sử đọc gần đây"
          >
            <Clock size={14} strokeWidth={2.3} />
          </button>
        </div>
      </div>

      {/* Thin Reading Progress Indicator Bar with Glowing Tip */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-outline-variant/15 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] transition-all duration-150 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </header>
  );
});
