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
  onOpenHistory: () => void;
}

export const ReaderHeader = memo(function ReaderHeader({
  bookId,
  bookName,
  chapterNumber,
  chapterTitle,
  progress = 0,
  isVisible = true,
  onOpenHistory,
}: ReaderHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-black/10 dark:bg-black/15 backdrop-blur-[2px] border-b border-blue-500/30 dark:border-blue-400/25 shadow-[0_8px_24px_rgba(0,0,0,0.4),_inset_0_-1px_0.5px_0_rgba(0,0,0,0.4)] px-3.5 py-2.5 w-full max-w-md mx-auto overflow-x-hidden box-border transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: Home Button */}
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-full bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-on-surface hover:text-primary hover:bg-white/15 transition-all flex-shrink-0 active:scale-95 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]"
          title="Về Thư viện"
        >
          <Home size={16} />
        </button>

        {/* Center: Book Name & Chapter Title (Centered) */}
        <div className="min-w-0 flex-1 text-center px-1">
          <p className="text-[10px] font-bold text-on-surface-variant/70 truncate tracking-tight text-center">
            {bookName || 'Đang tải...'}
          </p>
          <div className="mt-0.5 overflow-hidden w-full mx-auto max-w-[200px] sm:max-w-[250px]">
            {chapterTitle && chapterTitle.length > 22 ? (
              <div className="animate-marquee-text">
                <span className="text-xs font-extrabold text-on-surface tracking-tight pr-6">
                  {chapterTitle}
                </span>
                <span className="text-xs font-extrabold text-on-surface tracking-tight pr-6">
                  {chapterTitle}
                </span>
              </div>
            ) : (
              <span className="text-xs font-extrabold text-on-surface truncate block tracking-tight text-center">
                {chapterTitle || ''}
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick History Swap */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenHistory}
            className="p-2 rounded-full bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 text-primary hover:bg-white/15 transition-all active:scale-95 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]"
            title="Lịch sử đọc gần đây"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      {/* Thin Reading Progress Indicator Bar at Bottom Edge */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-outline-variant/20 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-150 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </header>
  );
});
