import React from 'react';
import { ArrowRight, Loader2, Check, Clock, Lock, AlertCircle } from 'lucide-react';
import { Chapter } from '../lib/api';

export type ChapterListVariant = 'detailed' | 'compact';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateStr;
  }
};

interface ChapterListProps {
  chapters: Chapter[];
  variant?: ChapterListVariant;
  activeChapterId?: string;
  onChapterClick: (chapter: Chapter) => void;
  lastChapterElementRef?: (node: HTMLElement | null) => void;
  firstChapterElementRef?: (node: HTMLElement | null) => void;
}

export function ChapterList({ 
  chapters, 
  variant = 'detailed',
  activeChapterId,
  onChapterClick,
  lastChapterElementRef,
  firstChapterElementRef
}: ChapterListProps) {
  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1.5 pb-4">
        {chapters.map((chap, index) => {
          const isActive = chap.chapterId === activeChapterId;
          const isPending = chap.state === 'PENDING';
          const isFailed = chap.state === 'FAILED';
          const isSucceeded = chap.state === 'SUCCEEDED';
          const isLast = index === chapters.length - 1;
          const isFirst = index === 0;

          return (
            <button
              id={`chapter-${chap.chapterId}`}
              ref={(node) => {
                if (isLast && lastChapterElementRef) (lastChapterElementRef as any)(node);
                if (isFirst && firstChapterElementRef) (firstChapterElementRef as any)(node);
              }}
              key={chap.chapterId}
              disabled={!isSucceeded && !isPending}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all border ${
                isActive 
                  ? 'bg-primary/10 border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.1)] ring-1 ring-primary/20' 
                  : isSucceeded 
                    ? 'bg-surface border-transparent hover:bg-surface-container-high active:scale-[0.98]' 
                    : isPending
                      ? 'bg-surface border-transparent opacity-80 hover:bg-surface-container-high active:scale-[0.98]'
                      : 'bg-surface-container-lowest border-transparent opacity-50 cursor-not-allowed'
              }`}
              onClick={() => {
                if (isSucceeded || isPending) {
                  onChapterClick(chap);
                }
              }}
            >
              <div className={`mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full border ${
                isActive ? 'bg-primary text-on-primary border-primary' :
                isSucceeded ? 'bg-surface-container-high text-on-surface-variant border-outline-variant/30' :
                isPending ? 'bg-warning/10 text-warning border-warning/20' :
                'bg-error/10 text-error border-error/20'
              }`}>
                {isActive ? <div className="w-1.5 h-1.5 rounded-full bg-current" /> :
                 isSucceeded ? <span className="text-[10px] font-bold">{chap.chapterNumber}</span> :
                 isPending ? <Lock size={12} /> :
                 <AlertCircle size={12} />}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className={`text-[13px] sm:text-[14px] leading-tight line-clamp-2 ${
                  isActive ? 'text-primary font-bold' : 
                  isSucceeded ? 'text-on-surface font-medium' :
                  'text-on-surface-variant'
                }`}>
                  {isActive && <span className="mr-1">Chương {chap.chapterNumber}:</span>}
                  {!isActive && isSucceeded && <span className="mr-1 opacity-70">Chương {chap.chapterNumber}:</span>}
                  {chap.title || 'Chương không có tựa đề'}
                </span>
                {!isSucceeded && (
                  <span className={`text-[10px] font-semibold mt-1 tracking-wide uppercase ${
                    isPending ? 'text-warning' : 'text-error'
                  }`}>
                    {isPending ? 'Chờ dịch' : 'Lỗi'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // default: 'detailed'
  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      {chapters.map((chapter, index) => {
        const isPending = chapter.state === 'PENDING';
        const isFailed = chapter.state === 'FAILED';
        const isSucceeded = chapter.state === 'SUCCEEDED';
        const isActive = chapter.chapterId === activeChapterId;
        const isLast = index === chapters.length - 1;
        const isFirst = index === 0;
        
        return (
          <button 
            id={`chapter-${chapter.chapterId}`}
            ref={(node) => {
              if (isLast && lastChapterElementRef) (lastChapterElementRef as any)(node);
              if (isFirst && firstChapterElementRef) (firstChapterElementRef as any)(node);
            }}
            key={chapter.chapterId}
            disabled={!isSucceeded && !isPending}
            onClick={(e) => {
              if (isSucceeded || isPending) {
                onChapterClick(chapter);
              }
            }}
            className={`cursor-pointer w-full text-left relative overflow-hidden block rounded-2xl p-3.5 sm:p-4 transition-all duration-300 group ${
              isActive ? 'bg-primary/5 border border-primary/40 shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.15)] ring-1 ring-primary/20' :
              isSucceeded ? 'bg-surface-container-low border border-outline-variant/30 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-surface-container hover:border-primary/40 focus:border-primary/40 active:scale-[0.98]' : 
              isPending ? 'bg-surface border border-outline-variant/20 hover:border-outline-variant/40 active:scale-[0.98]' : 
              'bg-surface-container-lowest border border-transparent opacity-60 cursor-not-allowed'
            }`}
          >
            {/* Subtle side indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
              isActive ? 'bg-primary' :
              isSucceeded ? 'bg-primary/20 group-hover:bg-primary/60' :
              isPending ? 'bg-warning/20 group-hover:bg-warning/50' :
              'bg-error/20'
            }`} />

            <div className="flex items-center gap-3.5 sm:gap-4 pl-1">
              {/* Left Number Badge */}
              <div className={`shrink-0 w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] rounded-full flex flex-col items-center justify-center border font-bold transition-colors ${
                isActive ? 'bg-primary text-on-primary border-primary' :
                isSucceeded ? 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-on-primary' :
                isPending ? 'bg-warning/10 text-warning border-warning/20' :
                'bg-error/10 text-error border-error/20'
              }`}>
                <span className="text-[9px] sm:text-[10px] leading-none opacity-80 mt-0.5">CH</span>
                <span className="text-[14px] sm:text-[16px] leading-none mt-0.5">{chapter.chapterNumber}</span>
              </div>

              {/* Middle Content */}
              <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-center">
                <h3 className={`text-[14px] sm:text-[15px] font-semibold leading-[1.3] truncate mb-1 ${
                  isSucceeded ? 'text-on-surface group-hover:text-primary transition-colors' :
                  isPending ? 'text-on-surface-variant' :
                  'text-on-surface-variant/70'
                }`}>
                  {chapter.title || `Chương ${chapter.chapterNumber}`}
                </h3>

                <div className="flex items-center flex-wrap gap-2.5">
                  <div className="flex items-center text-[10px] sm:text-[11px] text-on-surface-variant/70 font-medium">
                    <Clock size={10} className="mr-1 opacity-70 shrink-0" />
                    <span className="truncate">{formatDate(chapter.updatedAt)}</span>
                  </div>
                  
                  {isPending && (
                    <div className="flex items-center text-[9px] sm:text-[10px] font-bold text-warning uppercase tracking-wide bg-warning/10 px-1.5 py-0.5 rounded shrink-0">
                      <Lock size={10} className="mr-1" /> Chờ dịch
                    </div>
                  )}
                  
                  {isFailed && (
                    <div className="flex items-center text-[9px] sm:text-[10px] font-bold text-error uppercase tracking-wide bg-error/10 px-1.5 py-0.5 rounded shrink-0">
                      <AlertCircle size={10} className="mr-1" /> Lỗi dịch
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action */}
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all group-hover:bg-surface-container-highest">
                <ArrowRight size={18} className={`transition-all ${
                  isSucceeded ? 'text-primary/70 group-hover:text-primary group-hover:translate-x-0.5' :
                  isPending ? 'text-warning/70 group-hover:text-warning group-hover:translate-x-0.5' :
                  'text-on-surface-variant/30 grayscale'
                }`} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
