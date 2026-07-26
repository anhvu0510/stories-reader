import React, { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chapter } from '../../../shared/types';
import { ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface ChapterItemProps {
  chapter: Chapter;
  bookId?: string;
  isActive?: boolean;
  onClick?: () => void;
  showStatus?: boolean;
}

export const ChapterItem = forwardRef<HTMLDivElement, ChapterItemProps>(
  ({ chapter, bookId, isActive = false, onClick, showStatus = true }, ref) => {
    const navigate = useNavigate();

    const handleClick = () => {
      if (onClick) {
        onClick();
      } else if (bookId && chapter.chapterId) {
        navigate(`/book/${bookId}/chapter/${chapter.chapterId}`);
      }
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={`group relative rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 p-3 shadow-xs active:scale-[0.985] ${
          isActive
            ? 'bg-primary/15 border-primary/50 text-primary font-bold shadow-sm border-l-4 border-l-primary'
            : 'bg-surface-container-high border-outline-variant/30 hover:border-primary/40 text-on-surface hover:bg-surface-container-highest/80'
        }`}
      >
        {/* Left Side: Compact Modern CH Badge (Theme-Synced) */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-mono shadow-xs ${
            isActive
              ? 'bg-primary text-on-primary font-black'
              : 'bg-primary/10 border border-primary/20 text-primary'
          }`}
        >
          <span className="text-[11px] font-black leading-none">Ch.{chapter.chapterNumber}</span>
        </div>

        {/* Middle Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`text-xs font-bold leading-snug break-words whitespace-normal ${
                isActive ? 'text-primary font-extrabold' : 'text-on-surface group-hover:text-primary'
              }`}
            >
              {chapter.title || `Chương ${chapter.chapterNumber}`}
            </h4>
            {isActive && (
              <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9.5px] font-extrabold font-mono uppercase tracking-wider">
                Đang đọc
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Translation State Status Badge & Navigation Arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showStatus && (
            <div>
              {chapter.state === 'SUCCEEDED' && (
                <span
                  className="p-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center"
                  title="Đã dịch"
                >
                  <CheckCircle2 size={13} />
                </span>
              )}
              {chapter.state === 'PENDING' && (
                <span
                  className="p-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center"
                  title="Chưa dịch"
                >
                  <Clock size={13} />
                </span>
              )}
              {chapter.state === 'FAILED' && (
                <span
                  className="p-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center"
                  title="Lỗi dịch"
                >
                  <AlertCircle size={13} />
                </span>
              )}
            </div>
          )}

          <ArrowRight
            size={14}
            className={`transition-all ${
              isActive
                ? 'text-primary'
                : 'text-primary/60 group-hover:text-primary group-hover:translate-x-0.5'
            }`}
          />
        </div>
      </div>
    );
  }
);

ChapterItem.displayName = 'ChapterItem';
