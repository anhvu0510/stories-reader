import React, { useState, useRef, useEffect } from 'react';
import { LocateFixed, Volume2, Play, Pause, Square, SkipBack, SkipForward, Loader2, Music } from 'lucide-react';
import { ChapterDetailItem } from '../../../shared/types';
import { isEdgeReadAloudActive } from '../../../hooks/useEdgeReadAloudBgm';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../../hooks/useHaptic';

export interface VerticalBatchChapterNavProps {
  chapters?: ChapterDetailItem[];
  activeChapterId?: string;
  isVisible?: boolean;
  isTTSActive?: boolean;
  isTTSLoading?: boolean;
  isTTSPlaying?: boolean;
  isBgmActive?: boolean;
  showTTSControl?: boolean;
  onToggleBgm?: () => void;
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
  isBgmActive = false,
  showTTSControl = true,
  onToggleBgm,
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
      setHasBrowserReadAloudHighlight(isEdgeReadAloudActive());
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
    const highlightEl = document.querySelector('.msreadout-line-highlight, .msreadout-word-highlight, msreadoutspan');
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
          /* Inactive State: Single Floating 3D Circle Speaker Button + Conditional BGM & Locate Buttons */
          <div className="flex flex-col items-center gap-2.5">
            {/* Locate Highlight Button (shown when Edge Read Aloud highlight exists) */}
            {hasBrowserReadAloudHighlight && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  handleJumpToHighlight();
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-primary shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20"
                title="Nhảy tới dòng đang đọc"
                aria-label="Nhảy tới dòng đang đọc"
              >
                <LocateFixed size={16} />
              </motion.button>
            )}

            {/* BGM Toggle Button (shown ONLY when Edge Read Aloud highlight exists) */}
            {hasBrowserReadAloudHighlight && onToggleBgm && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  onToggleBgm();
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 ${
                  isBgmActive
                    ? 'bg-primary/25 text-primary border border-primary/60 shadow-[0_3px_12px_rgba(59,130,246,0.45)]'
                    : 'bg-black/20 dark:bg-black/40 border border-primary/50 text-on-surface hover:text-primary'
                }`}
                title={isBgmActive ? 'Tắt nhạc nền (Đang phát)' : 'Bật nhạc nền thư giãn'}
                aria-label={isBgmActive ? 'Tắt nhạc nền (Đang phát)' : 'Bật nhạc nền thư giãn'}
              >
                <Music size={16} className={isBgmActive ? 'animate-pulse text-primary' : ''} />
              </motion.button>
            )}

            {/* Speaker Button (controlled strictly by showTTSControl setting in app config) */}
            {(showTTSControl || isTTSLoading) && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  if (onToggleTTS) onToggleTTS();
                  else if (onTTSPlay) onTTSPlay();
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-primary shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20"
                title={isTTSLoading ? 'Đang chuẩn bị âm thanh... (Bấm để hủy)' : 'Bật đọc thành tiếng (Read Aloud)'}
                aria-label={isTTSLoading ? 'Đang chuẩn bị âm thanh' : 'Bật đọc thành tiếng'}
              >
                {isTTSLoading ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <Volume2 size={16} />
                )}
              </motion.button>
            )}
          </div>
        ) : (
          /* Active State: Vertical Stack of Independent Floating 3D Circle Buttons */
          <div className="flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-90 duration-300 ease-out">
            {/* Locate Highlight Button (shown when line highlight exists) */}
            {hasBrowserReadAloudHighlight && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  handleJumpToHighlight();
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-primary shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20"
                title="Nhảy tới dòng đang đọc"
                aria-label="Nhảy tới dòng đang đọc"
              >
                <LocateFixed size={16} />
              </motion.button>
            )}

            {/* BGM Toggle Button (shown ONLY when Edge Read Aloud highlight exists) */}
            {hasBrowserReadAloudHighlight && onToggleBgm && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  onToggleBgm();
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 ${
                  isBgmActive
                    ? 'bg-primary/25 text-primary border border-primary/60 shadow-[0_3px_12px_rgba(59,130,246,0.45)]'
                    : 'bg-black/20 dark:bg-black/40 border border-primary/50 text-on-surface hover:text-primary'
                }`}
                title={isBgmActive ? 'Tắt nhạc nền (Đang phát)' : 'Bật nhạc nền thư giãn'}
                aria-label={isBgmActive ? 'Tắt nhạc nền (Đang phát)' : 'Bật nhạc nền thư giãn'}
              >
                <Music size={16} className={isBgmActive ? 'animate-pulse text-primary' : ''} />
              </motion.button>
            )}

            {/* Play / Pause Toggle Button */}
            {isTTSPlaying ? (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  if (onTTSPause) onTTSPause();
                }}
                className="w-9.5 h-9.5 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 transition-colors cursor-pointer"
                title="Tạm dừng đọc"
                aria-label="Tạm dừng đọc"
              >
                <Pause size={16} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  if (onTTSPlay) onTTSPlay();
                }}
                className="w-9.5 h-9.5 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 transition-colors cursor-pointer"
                title="Tiếp tục đọc"
                aria-label="Tiếp tục đọc"
              >
                <Play size={16} fill="currentColor" />
              </motion.button>
            )}

            {/* Prev Section Button */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                if (onTTSPrev) onTTSPrev();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-on-surface shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 hover:text-primary transition-colors cursor-pointer"
              title="Đoạn trước"
              aria-label="Đoạn trước"
            >
              <SkipBack size={16} />
            </motion.button>

            {/* Next Section Button */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                if (onTTSNext) onTTSNext();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-on-surface shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 hover:text-primary transition-colors cursor-pointer"
              title="Đoạn sau"
              aria-label="Đoạn sau"
            >
              <SkipForward size={16} />
            </motion.button>

            {/* Stop Button (Standalone floating circle) */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('warning');
                if (onTTSStop) onTTSStop();
                else if (onToggleTTS) onToggleTTS();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-rose-400 bg-rose-500/10 backdrop-blur-[2px] border border-rose-500/40 shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-rose-500/20 transition-colors cursor-pointer mt-0.5"
              title="Dừng đọc"
              aria-label="Dừng đọc"
            >
              <Square size={13} fill="currentColor" />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
