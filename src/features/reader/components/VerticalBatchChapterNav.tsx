import React, { useRef, useEffect } from 'react';
import { LocateFixed } from 'lucide-react';
import { ChapterDetailItem } from '../../../shared/types';

export interface VerticalBatchChapterNavProps {
  chapters: ChapterDetailItem[];
  activeChapterId?: string;
  isVisible?: boolean;
}

export function VerticalBatchChapterNav({
  chapters,
  activeChapterId,
  isVisible = true,
}: VerticalBatchChapterNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll active circle button into view inside vertical strip
  useEffect(() => {
    if (!activeChapterId || !containerRef.current) return;
    const activeEl = containerRef.current.querySelector(
      `[data-nav-chapter-id="${activeChapterId}"]`
    ) as HTMLElement | null;

    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeChapterId]);

  if (!chapters || chapters.length <= 1) return null;

  const handleJumpToChapter = (chapterId: string) => {
    if (typeof document === 'undefined') return;
    const targetEl = document.getElementById(`chapter-section-${chapterId}`);
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const handleJumpToHighlight = () => {
    if (typeof document === 'undefined') return;
    const highlightEl = document.querySelector('.msreadout-line-highlight');
    if (highlightEl && typeof highlightEl.scrollIntoView === 'function') {
      highlightEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  return (
    <div
      aria-hidden="true"
      className={`fixed bottom-[100px] left-0 right-0 z-40 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-all duration-300 transform-gpu ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : '-translate-x-12 opacity-0 pointer-events-none'
      }`}
    >
      <div
        ref={containerRef}
        className="w-fit p-1.5 rounded-full bg-surface-container-low/85 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl shadow-black/20 flex flex-col items-center gap-1.5 max-h-[48vh] overflow-y-auto no-scrollbar pointer-events-auto box-border"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleJumpToHighlight();
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer bg-primary/20 text-primary hover:bg-primary hover:text-on-primary active:scale-90"
          title="Nhảy tới dòng đang đọc / highlight"
          aria-label="Nhảy tới dòng đang đọc"
        >
          <LocateFixed size={15} />
        </button>

        <div className="w-4 h-[1px] bg-outline-variant/40 shrink-0 my-0.5" />

        {chapters.map((chap) => {
          const isActive = chap.chapterId === activeChapterId;

          return (
            <button
              key={chap.chapterId}
              data-nav-chapter-id={chap.chapterId}
              onClick={(e) => {
                e.stopPropagation();
                handleJumpToChapter(chap.chapterId);
              }}
              className={`w-8 h-8 rounded-full text-xs font-mono font-black tracking-tight flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer relative ${
                isActive
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/30 scale-105 border border-primary/50'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 active:scale-95'
              }`}
              title={
                chap.title?.toLowerCase().startsWith('chương')
                  ? chap.title
                  : `Chương ${chap.chapterNumber}: ${chap.title}`
              }
            >
              <span>{chap.chapterNumber}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-on-primary absolute top-0.5 right-0.5 animate-pulse shadow-xs" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

