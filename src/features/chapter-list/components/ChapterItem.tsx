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
  ({ chapter, bookId, isActive = false, onClick, showStatus = true }, ref) => {
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
        className={`group relative rounded-2xl transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 p-3 active:scale-[0.985] ${
          isActive
            ? 'border-2 border-primary bg-primary/15 shadow-md ring-2 ring-primary/25 text-on-surface'
            : 'border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest/80 hover:border-primary/40 text-on-surface'
        }`}
      >
        {/* Left Side: Flex Pill CH Badge (Never overflows for 4-6 digit numbers) */}
        <div
          className={`px-2.5 py-1 min-w-[40px] h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-[11px] whitespace-nowrap shadow-xs transition-colors ${
            isActive
              ? 'bg-primary text-on-primary font-extrabold'
              : 'bg-primary/10 border border-primary/20 text-primary'
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
                  ? 'text-primary font-black tracking-tight'
                  : 'font-bold text-on-surface group-hover:text-primary'
              }`}
            >
              {chapter.title || `Chương ${chapter.chapterNumber}`}
            </h4>

            {isActive && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9.5px] font-mono font-black shrink-0 tracking-wider flex items-center gap-1 shadow-2xs">
                <span>📌 ĐANG ĐỌC</span>
              </span>
            )}
          </div>

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
            className={`transition-all ${
              isActive
                ? 'text-primary translate-x-0.5'
                : 'text-primary/60 group-hover:text-primary group-hover:translate-x-0.5'
            }`}
          />
        </div>
      </div>
    );
  }
);

ChapterItem.displayName = 'ChapterItem';
