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
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 px-3.5 py-2.5 w-full max-w-md mx-auto shadow-md overflow-x-hidden box-border transition-all duration-300 transform-gpu"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: Home Button */}
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-full bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface transition-all flex-shrink-0 active:scale-95 shadow-sm"
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
            className="p-2 rounded-full bg-surface-container-high border border-outline-variant/30 text-primary hover:bg-surface transition-all active:scale-95 shadow-sm"
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
