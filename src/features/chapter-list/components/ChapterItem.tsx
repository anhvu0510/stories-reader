import React, { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chapter } from '../../../shared/types';
import { ArrowRight, Sparkles, Clock, AlertCircle, Calendar } from 'lucide-react';

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
  ({ chapter, bookId, onClick, showStatus = true }, ref) => {
    const navigate = useNavigate();
    const formattedDate = formatDate(chapter.updatedAt);

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
        className="group relative rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest/80 hover:border-primary/40 text-on-surface transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 p-3 shadow-xs active:scale-[0.985]"
      >
        {/* Left Side: Compact Modern CH Badge (Theme-Synced) */}
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 font-mono text-primary shadow-xs">
          <span className="text-[11px] font-black leading-none">Ch.{chapter.chapterNumber}</span>
        </div>

        {/* Middle Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <h4 className="text-xs font-bold leading-snug text-on-surface group-hover:text-primary transition-colors break-words whitespace-normal">
            {chapter.title || `Chương ${chapter.chapterNumber}`}
          </h4>
          {formattedDate && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/60">
              <Calendar size={10} className="text-on-surface-variant/50" />
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
                  className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-2xs"
                  title="Đã dịch AI"
                >
                  <Sparkles size={12} />
                </span>
              )}
              {chapter.state === 'PENDING' && (
                <span
                  className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center"
                  title="Chờ dịch"
                >
                  <Clock size={12} />
                </span>
              )}
              {chapter.state === 'FAILED' && (
                <span
                  className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center"
                  title="Lỗi dịch"
                >
                  <AlertCircle size={12} />
                </span>
              )}
            </div>
          )}

          <ArrowRight
            size={14}
            className="text-primary/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    );
  }
);

ChapterItem.displayName = 'ChapterItem';
