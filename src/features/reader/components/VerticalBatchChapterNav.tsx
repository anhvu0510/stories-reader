import React, { useState, useRef, useEffect } from 'react';
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
  const [hasHighlight, setHasHighlight] = useState(false);

  // Monitor DOM for presence of .msreadout-line-highlight element
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkHighlight = () => {
      if (typeof document === 'undefined') return;
      const el = document.querySelector('.msreadout-line-highlight');
      setHasHighlight(Boolean(el));
    };

    checkHighlight();

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        checkHighlight();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => {
        observer.disconnect();
      };
    }
  }, []);

  if (!chapters || chapters.length <= 1) return null;
  if (!hasHighlight) return null;

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
      </div>
    </div>
  );
}

