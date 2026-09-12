import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  LocateFixed,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/useAppStore';
import { useModalStore } from '../../../stores/useModalStore';
import { ChapterDetailItem } from '../../../shared/types';

interface ReaderQuickControlProps {
  bookId: string;
  prevChapterId?: string;
  nextChapterId?: string;
  currentChapterNumber?: number;
  chapterDisplayLabel?: string;
  totalChapters?: number;
  isVisible?: boolean;
  isTTSActive?: boolean;
  isTTSPlaying?: boolean;
  currentParagraphIndex?: number;
  chapters?: ChapterDetailItem[];
  activeChapterId?: string;
  onOpenChapterSelect: () => void;
  onOpenTranslation: () => void;
  onToggleTTS?: () => void;
  onTTSPlay?: () => void;
  onTTSPause?: () => void;
  onTTSStop?: () => void;
  onTTSPrev?: () => void;
  onTTSNext?: () => void;
}

export function ReaderQuickControl({
  bookId,
  prevChapterId,
  nextChapterId,
  currentChapterNumber,
  chapterDisplayLabel,
  totalChapters,
  isVisible = true,
  isTTSActive = false,
  isTTSPlaying = false,
  chapters,
  activeChapterId,
  onOpenChapterSelect,
  onOpenTranslation,
  onToggleTTS,
  onTTSPlay,
  onTTSPause,
  onTTSStop,
  onTTSPrev,
  onTTSNext,
}: ReaderQuickControlProps) {
  const navigate = useNavigate();
  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const openSettings = useModalStore((state) => state.openSettings);

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

  const hasPrev = Boolean(
    prevChapterId &&
      prevChapterId !== 'null' &&
      prevChapterId !== 'undefined' &&
      String(prevChapterId).trim() !== ''
  );
  const hasNext = Boolean(
    nextChapterId &&
      nextChapterId !== 'null' &&
      nextChapterId !== 'undefined' &&
      String(nextChapterId).trim() !== ''
  );

  return (
    <div
      aria-hidden="true"
      className={`fixed bottom-4 left-0 right-0 z-50 w-full max-w-[420px] sm:max-w-md mx-auto px-3 sm:px-4 pointer-events-none box-border overflow-x-hidden transition-all duration-300 cubic-bezier(0.16,1,0.3,1) ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-16 opacity-0 scale-95'
      }`}
    >
      {/* Permanently Ultra-Translucent Pure Crystal Glass Dock Container with 3D Primary Theme Beveled Edge */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-black/25 dark:bg-black/40 backdrop-blur-[3px] border border-primary/35 dark:border-primary/30 shadow-[0_16px_36px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.45),_inset_0_-1px_0.5px_0_rgba(0,0,0,0.4)] rounded-full px-3 py-2 flex items-center justify-between gap-2 pointer-events-auto transition-all duration-300 overflow-hidden"
      >
        {/* LEFT GROUP: macOS Control Center Joined Segment Capsule with 3D Primary Glass Rim */}
        <div className="relative z-10 flex items-center gap-1.5 bg-white/5 dark:bg-white/5 p-1 rounded-full border border-primary/25 dark:border-primary/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3),_inset_0_-1px_0.5px_rgba(0,0,0,0.3)] shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrev) {
                navigate(`/book/${bookId}/chapter/${prevChapterId}`);
              }
            }}
            disabled={!hasPrev}
            className={`p-2 rounded-full flex items-center justify-center transition-all duration-150 ${
              hasPrev
                ? 'bg-white/10 dark:bg-white/10 border border-primary/25 text-white shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:bg-white/20 active:scale-90 cursor-pointer opacity-100'
                : 'bg-white/5 text-white/20 border border-white/5 opacity-30 cursor-not-allowed pointer-events-none'
            }`}
            title={hasPrev ? 'Chương trước' : 'Đã ở chương đầu tiên'}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasNext) {
                navigate(`/book/${bookId}/chapter/${nextChapterId}`);
              }
            }}
            disabled={!hasNext}
            className={`p-2 rounded-full flex items-center justify-center transition-all duration-150 ${
              hasNext
                ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black font-bold border border-amber-300/70 shadow-[0_4px_16px_rgba(245,158,11,0.5),_inset_0_1px_1px_rgba(255,255,255,0.6),_inset_0_-1px_1px_rgba(0,0,0,0.3)] hover:brightness-110 active:scale-90 cursor-pointer opacity-100'
                : 'bg-white/5 text-white/20 border border-white/5 opacity-30 cursor-not-allowed pointer-events-none'
            }`}
            title={hasNext ? 'Chương sau' : 'Đã ở chương mới nhất'}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Vertical macOS Glass Separator Line */}
        <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/30 dark:via-primary/25 to-transparent shrink-0 mx-0.5" />

        {/* CENTER: Dynamic Mode (Chapter Selector Pill vs Inline TTS Audio Suite) */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-w-0 px-1 py-0.5">
          {isTTSActive ? (
            /* Inline TTS Player Suite */
            <div className="flex items-center gap-1 bg-white/5 dark:bg-white/5 backdrop-blur-sm px-2.5 py-1 rounded-full border border-primary/25 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3),_0_4px_12px_rgba(0,0,0,0.2)] animate-in fade-in duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSPrev) onTTSPrev();
                }}
                className="p-1.5 rounded-full text-white/90 hover:text-primary hover:bg-white/15 transition-all active:scale-90"
                title="Đoạn trước"
              >
                <SkipBack size={15} />
              </button>

              {isTTSPlaying ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSPause) onTTSPause();
                  }}
                  className="p-2 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black rounded-full shadow-[0_4px_14px_rgba(245,158,11,0.5),_inset_0_1px_1px_rgba(255,255,255,0.5)] active:scale-90 transition-all"
                  title="Tạm dừng"
                >
                  <Pause size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSPlay) onTTSPlay();
                  }}
                  className="p-2 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black rounded-full shadow-[0_4px_14px_rgba(245,158,11,0.5),_inset_0_1px_1px_rgba(255,255,255,0.5)] active:scale-90 transition-all"
                  title="Tiếp tục đọc"
                >
                  <Play size={15} fill="currentColor" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSNext) onTTSNext();
                }}
                className="p-1.5 rounded-full text-white/90 hover:text-primary hover:bg-white/15 transition-all active:scale-90"
                title="Đoạn sau"
              >
                <SkipForward size={15} />
              </button>

              <div className="w-[1px] h-3.5 bg-primary/30 mx-1" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSStop) onTTSStop();
                }}
                className="p-1.5 text-error hover:bg-error/20 rounded-full transition-all active:scale-90"
                title="Dừng đọc"
              >
                <Square size={13} fill="currentColor" />
              </button>
            </div>
          ) : chapters && chapters.length > 1 ? (
            /* Multi-Chapter Batch Mode: Chapter Number Badges + Range Trigger Pill */
            <div className="flex flex-col items-center justify-center gap-1 max-w-full">
              <div
                className="flex items-center justify-center gap-1.5 max-w-full overflow-x-auto no-scrollbar px-1 py-0.5"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
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
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black font-black border border-amber-300/70 shadow-[0_4px_16px_rgba(245,158,11,0.5),_inset_0_1px_1px_rgba(255,255,255,0.6),_inset_0_-1px_1px_rgba(0,0,0,0.3)] scale-105'
                          : 'bg-white/5 dark:bg-white/5 text-white font-mono font-bold border border-primary/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] hover:bg-white/15 active:scale-95'
                      }`}
                      title={
                        chap.title?.toLowerCase().startsWith('chương')
                          ? chap.title
                          : `Chương ${chap.chapterNumber}: ${chap.title}`
                      }
                    >
                      <span>{chap.chapterNumber}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChapterSelect();
                }}
                className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/5 dark:bg-white/5 border border-primary/25 text-primary font-bold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)] hover:bg-white/15 hover:border-primary/50 transition-all active:scale-95 cursor-pointer"
                title="Mở bảng chọn chương"
              >
                <span className="text-[10px] font-black font-mono text-primary leading-none tracking-tight">
                  {chapterDisplayLabel || (currentChapterNumber !== undefined ? currentChapterNumber : '-')}
                </span>
                {totalChapters ? (
                  <span className="text-[9px] font-bold font-mono text-primary/70">
                    /{totalChapters}
                  </span>
                ) : null}
                <ChevronDown size={11} className="text-primary/80 shrink-0 ml-0.5" />
              </button>
            </div>
          ) : (
            /* Single Chapter Mode */
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChapterSelect();
              }}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/5 dark:bg-white/5 border border-primary/25 text-primary font-bold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)] hover:bg-white/15 hover:border-primary/50 transition-all active:scale-95 cursor-pointer"
              title="Mở bảng chọn chương"
            >
              {!chapterDisplayLabel && (
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary/80 font-mono">CHƯƠNG</span>
              )}
              <span className="text-xs font-black font-mono text-primary leading-none ml-0.5">
                {chapterDisplayLabel || (currentChapterNumber !== undefined ? currentChapterNumber : '-')}
              </span>
              {totalChapters ? (
                <span className="text-[10px] font-bold font-mono text-primary/70">
                  /{totalChapters}
                </span>
              ) : null}
              <ChevronDown size={12} className="text-primary/80 shrink-0 ml-0.5" />
            </button>
          )}
        </div>

        {/* Vertical macOS Glass Separator Line */}
        <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/30 dark:via-primary/25 to-transparent shrink-0 mx-0.5" />

        {/* RIGHT GROUP: macOS Sonoma Control Center Glass Spheres */}
        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {/* System Settings Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSettings('reader');
            }}
            className="p-2.5 rounded-full bg-white/5 dark:bg-white/5 border border-primary/25 text-white shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3),_inset_0_-1px_0.5px_rgba(0,0,0,0.3)] hover:text-primary hover:rotate-45 hover:bg-white/15 transition-all duration-300 active:scale-90"
            title="Cài đặt đọc sách"
          >
            <Settings size={16} />
          </button>

          {/* AI Translation Button (Online Only) */}
          {!isOfflineMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTranslation();
              }}
              className="p-2.5 rounded-full bg-amber-400/15 dark:bg-amber-400/10 border border-primary/40 text-amber-300 shadow-[0_4px_16px_rgba(245,158,11,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-amber-400/25 transition-all active:scale-90"
              title="Dịch AI"
            >
              <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
