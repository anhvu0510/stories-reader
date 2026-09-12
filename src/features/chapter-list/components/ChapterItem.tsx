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
            ? 'bg-amber-400/20 hover:bg-amber-400/25 backdrop-blur-md border-2 border-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.35),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] text-amber-300'
            : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border-2 border-outline-variant/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),_0_4px_12px_rgba(0,0,0,0.3)] hover:border-amber-400/80 text-on-surface'
        }`}
      >
        {/* Left Side: Flex Pill CH Badge (Never overflows for 4-6 digit numbers) */}
        <div
          className={`px-2.5 py-1 min-w-[40px] h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-[11px] whitespace-nowrap transition-colors ${
            isActive
              ? 'bg-amber-400/30 border border-amber-400/70 text-amber-300 font-extrabold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
              : 'bg-amber-400/10 border border-amber-400/30 text-amber-400/90 font-bold'
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
                  ? 'text-amber-300 font-black tracking-tight drop-shadow-xs'
                  : 'font-bold text-on-surface group-hover:text-amber-400'
              }`}
            >
              {chapter.title || `Chương ${chapter.chapterNumber}`}
            </h4>
          </div>

          {formattedDate && (
            <div className={`flex items-center gap-1 text-[10px] font-mono ${isActive ? 'text-amber-200/80 font-medium' : 'text-on-surface-variant/60'}`}>
              <Calendar size={10} className={isActive ? 'text-amber-300/70' : 'text-on-surface-variant/50'} />
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
                      ? 'bg-amber-400/25 border border-amber-400/50 text-amber-300 font-bold'
                      : 'bg-amber-500/15 border border-amber-400/30 text-amber-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
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
                ? 'text-amber-300 translate-x-0.5'
                : 'text-amber-400/70 group-hover:text-amber-400 group-hover:translate-x-0.5'
            }`}
          />
        </div>
      </div>
    );
  }
);

ChapterItem.displayName = 'ChapterItem';
