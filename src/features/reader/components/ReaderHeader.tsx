import React, { memo } from 'react';
import { Home, Clock, Volume2 } from 'lucide-react';
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
      className="fixed top-0 left-0 right-0 z-40 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] border-b border-white/25 dark:border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4)] px-3.5 py-2.5 w-full max-w-md mx-auto overflow-x-hidden box-border transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: Home Button */}
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-full bg-white/10 dark:bg-white/10 border border-white/30 text-on-surface hover:text-primary hover:bg-white/20 transition-all flex-shrink-0 active:scale-90 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] cursor-pointer"
          title="Về Thư viện"
        >
          <Home size={16} />
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

        {/* Right: Quick TTS Toggle & History Swap */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onToggleTTS}
            className={`p-2 rounded-full border transition-all active:scale-90 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] cursor-pointer ${
              isTTSActive
                ? 'bg-primary text-on-primary border-primary animate-pulse'
                : 'bg-white/10 dark:bg-white/10 border-white/30 text-on-surface hover:text-primary hover:bg-white/20'
            }`}
            title={isTTSActive ? 'Tắt đọc thành tiếng' : 'Bật đọc thành tiếng (VieNeu AI TTS)'}
          >
            <Volume2 size={16} />
          </button>

          <button
            onClick={onOpenHistory}
            className="p-2 rounded-full bg-white/10 dark:bg-white/10 border border-white/30 text-primary hover:bg-white/20 transition-all active:scale-90 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] cursor-pointer"
            title="Lịch sử đọc gần đây"
          >
            <Clock size={16} />
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
