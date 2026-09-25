import React, { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chapter } from '../../../shared/types';
import { ArrowRight, Sparkles, Clock, AlertCircle, Calendar } from 'lucide-react';
import { openChapter } from '../../../shared/utils/openChapter';
import { triggerHaptic } from '../../../hooks/useHaptic';

export interface ChapterItemProps {
  chapter: Chapter;
  bookId?: string;
  isActive?: boolean;
  onClick?: () => void;
  showStatus?: boolean;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

export const ChapterItem = forwardRef<HTMLDivElement, ChapterItemProps>(
  ({ chapter, bookId, isActive = false, onClick, showStatus = true }, ref) => {
    const navigate = useNavigate();
    const formattedDate = formatDate(chapter.updatedAt);

    const handleClick = () => {
      triggerHaptic('light');
      if (onClick) {
        onClick();
      } else if (bookId && chapter.chapterId) {
        openChapter(bookId, chapter.chapterId);
      }
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={`group relative rounded-2xl transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 p-3 active:scale-[0.985] ${
          isActive
            ? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary shadow-xs'
            : 'bg-white/[0.04] dark:bg-white/[0.04] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] border border-white/10 dark:border-white/10 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.15)] hover:border-primary/50 text-on-surface'
        }`}
      >
        {/* Left Side: Flex Pill CH Badge (Never overflows for 4-6 digit numbers) */}
        <div
          className={`px-2.5 py-1 min-w-[40px] h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-[11px] whitespace-nowrap transition-colors ${
            isActive
              ? 'bg-primary/30 border border-primary/70 text-primary font-extrabold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
              : 'bg-primary/10 border border-primary/30 text-primary/90 font-bold'
          }`}
        >
          <span>Ch.{chapter.chapterNumber}</span>
        </div>

        {/* Middle Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <h4
              className={`text-xs leading-snug transition-colors break-words whitespace-normal ${
                isActive
                  ? 'text-primary font-black tracking-tight drop-shadow-xs'
                  : 'font-bold text-on-surface group-hover:text-primary'
              }`}
            >
              {chapter.title || `Chương ${chapter.chapterNumber}`}
            </h4>
          </div>

          {formattedDate && (
            <div className={`flex items-center gap-1 text-[10px] font-mono ${isActive ? 'text-primary/80 font-medium' : 'text-on-surface-variant/60'}`}>
              <Calendar size={10} className={isActive ? 'text-primary/70' : 'text-on-surface-variant/50'} />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        {/* Right Side: Sleek Modern Status Badge & Navigation Arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showStatus && (
            <div>
              {chapter.state === 'SUCCEEDED' && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shadow-2xs ${
                    isActive
                      ? 'bg-emerald-400/25 border border-emerald-400/50 text-emerald-300 font-bold'
                      : 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
                  }`}
                  title="Đã dịch AI"
                >
                  <Sparkles size={12} />
                </span>
              )}
              {chapter.state === 'PENDING' && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-primary/25 border border-primary/50 text-primary font-bold'
                      : 'bg-primary/15 border border-primary/30 text-primary shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
                  }`}
                  title="Chờ dịch"
                >
                  <Clock size={12} />
                </span>
              )}
              {chapter.state === 'FAILED' && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-rose-400/25 border border-rose-400/50 text-rose-300 font-bold'
                      : 'bg-rose-500/15 border border-rose-400/30 text-rose-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
                  }`}
                  title="Lỗi dịch"
                >
                  <AlertCircle size={12} />
                </span>
              )}
            </div>
          )}

          <ArrowRight
            size={14}
            className={`transition-all ${
              isActive
                ? 'text-primary translate-x-0.5'
                : 'text-primary/70 group-hover:text-primary group-hover:translate-x-0.5'
            }`}
          />
        </div>
      </div>
    );
  }
);

ChapterItem.displayName = 'ChapterItem';
