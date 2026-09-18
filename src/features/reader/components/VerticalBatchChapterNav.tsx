import React, { useState, useRef, useEffect } from 'react';
import { LocateFixed, Volume2, Play, Pause, Square, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { ChapterDetailItem } from '../../../shared/types';

export interface VerticalBatchChapterNavProps {
  chapters?: ChapterDetailItem[];
  activeChapterId?: string;
  isVisible?: boolean;
  isTTSActive?: boolean;
  isTTSLoading?: boolean;
  isTTSPlaying?: boolean;
  currentParagraphIndex?: number;
  onToggleTTS?: () => void;
  onTTSPlay?: () => void;
  onTTSPause?: () => void;
  onTTSStop?: () => void;
  onTTSPrev?: () => void;
  onTTSNext?: () => void;
}

export function VerticalBatchChapterNav({
  chapters,
  activeChapterId,
  isVisible = true,
  isTTSActive = false,
  isTTSLoading = false,
  isTTSPlaying = false,
  currentParagraphIndex = 0,
  onToggleTTS,
  onTTSPlay,
  onTTSPause,
  onTTSStop,
  onTTSPrev,
  onTTSNext,
}: VerticalBatchChapterNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasBrowserReadAloudHighlight, setHasBrowserReadAloudHighlight] = useState(false);

  // Edge Read Aloud owns this class; the app TTS uses a separate namespace.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkHighlight = () => {
      if (typeof document === 'undefined') return;
      const el = document.querySelector('.msreadout-line-highlight');
      setHasBrowserReadAloudHighlight(Boolean(el));
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
      className={`fixed bottom-[100px] left-0 right-0 z-40 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-all duration-300 cubic-bezier(0.16,1,0.3,1) transform-gpu ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : '-translate-x-14 opacity-0 pointer-events-none'
      }`}
    >
      <div
        ref={containerRef}
        className="w-fit flex flex-col items-center gap-2 pointer-events-auto box-border transition-all duration-300 transform-gpu"
      >
        {!isTTSActive ? (
          /* Inactive State: Single Floating 3D Circle Speaker Button */
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleTTS) onToggleTTS();
              else if (onTTSPlay) onTTSPlay();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer bg-black/10 dark:bg-black/20 backdrop-blur-[1.5px] border border-primary/50 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 active:scale-90"
            title={isTTSLoading ? 'Đang chuẩn bị âm thanh... (Bấm để hủy)' : 'Bật đọc thành tiếng (Read Aloud)'}
            aria-label={isTTSLoading ? 'Đang chuẩn bị âm thanh' : 'Bật đọc thành tiếng'}
          >
            {isTTSLoading ? (
              <Loader2 size={13.5} className="animate-spin text-primary" />
            ) : (
              <Volume2 size={13.5} />
            )}
          </button>
        ) : (
          /* Active State: Vertical Stack of Independent Floating 3D Circle Buttons (No Capsule Shell) */
          <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-90 duration-300 ease-out">
            {/* Locate Highlight Button (shown when line highlight exists) */}
            {hasBrowserReadAloudHighlight && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleJumpToHighlight();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer bg-black/10 dark:bg-black/20 backdrop-blur-[1.5px] border border-primary/50 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 active:scale-90"
                title="Nhảy tới dòng đang đọc"
                aria-label="Nhảy tới dòng đang đọc"
              >
                <LocateFixed size={13.5} />
              </button>
            )}

            {/* Play / Pause Toggle Button */}
            {isTTSPlaying ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSPause) onTTSPause();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[1.5px] shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 active:scale-90 transition-all duration-150 cursor-pointer"
                title="Tạm dừng đọc"
                aria-label="Tạm dừng đọc"
              >
                <Pause size={13.5} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSPlay) onTTSPlay();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[1.5px] shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 active:scale-90 transition-all duration-150 cursor-pointer"
                title="Tiếp tục đọc"
                aria-label="Tiếp tục đọc"
              >
                <Play size={13.5} fill="currentColor" />
              </button>
            )}

            {/* Prev Section Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onTTSPrev) onTTSPrev();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-black/10 dark:bg-black/20 backdrop-blur-[1.5px] border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 hover:text-primary active:scale-90 transition-all duration-150 cursor-pointer"
              title="Đoạn trước"
              aria-label="Đoạn trước"
            >
              <SkipBack size={13.5} />
            </button>

            {/* Next Section Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onTTSNext) onTTSNext();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-black/10 dark:bg-black/20 backdrop-blur-[1.5px] border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 hover:text-primary active:scale-90 transition-all duration-150 cursor-pointer"
              title="Đoạn sau"
              aria-label="Đoạn sau"
            >
              <SkipForward size={13.5} />
            </button>

            {/* Stop Button (Standalone floating circle) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onTTSStop) onTTSStop();
                else if (onToggleTTS) onToggleTTS();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-rose-400 bg-rose-500/10 backdrop-blur-[1.5px] border border-rose-500/40 shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-rose-500/20 active:scale-90 transition-all duration-150 cursor-pointer mt-1"
              title="Dừng đọc"
              aria-label="Dừng đọc"
            >
              <Square size={11.5} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
