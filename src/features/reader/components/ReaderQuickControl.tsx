import React from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
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
  List,
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

  React.useEffect(() => {
    if (!activeChapterId) return;
    const activeBtn = document.querySelector(`[data-nav-chapter-id="${activeChapterId}"]`);
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeChapterId]);

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
      className={`fixed bottom-4 left-0 right-0 z-50 w-full max-w-[420px] sm:max-w-md mx-auto px-3 sm:px-4 pointer-events-none box-border transition-all duration-300 cubic-bezier(0.16,1,0.3,1) ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-16 opacity-0 scale-95'
      }`}
    >
      {/* Permanently Ultra-Translucent Pure Crystal Glass Dock Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] border border-white/25 dark:border-white/25 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1.5px_1px_0_rgba(255,255,255,0.45),_inset_0_-1.5px_1px_0_rgba(0,0,0,0.4)] rounded-full px-3 py-1.5 flex items-center justify-between gap-2 pointer-events-auto transition-all duration-300"
      >
        {/* LEFT GROUP: macOS Control Center Joined Segment Capsule */}
        <div className="relative z-10 flex items-center gap-1.5 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)] shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrev) {
                navigate(`/book/${bookId}/chapter/${prevChapterId}`);
              }
            }}
            disabled={!hasPrev}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
              hasPrev
                ? 'bg-white/10 border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 active:scale-90 cursor-pointer opacity-100'
                : 'bg-white/[0.06] text-on-surface-variant/40 border border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] opacity-70 cursor-not-allowed pointer-events-none'
            }`}
            title={hasPrev ? 'Chương trước' : 'Đã ở chương đầu tiên'}
          >
            <ChevronsLeft size={17} strokeWidth={2.5} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasNext) {
                navigate(`/book/${bookId}/chapter/${nextChapterId}`);
              }
            }}
            disabled={!hasNext}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
              hasNext
                ? 'bg-primary/25 text-primary font-bold border border-primary/60 shadow-[0_4px_12px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 active:scale-90 cursor-pointer opacity-100'
                : 'bg-white/[0.06] text-on-surface-variant/40 border border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] opacity-70 cursor-not-allowed pointer-events-none'
            }`}
            title={hasNext ? 'Chương sau' : 'Đã ở chương mới nhất'}
          >
            <ChevronsRight size={17} strokeWidth={2.5} />
          </button>
        </div>

        {/* Vertical macOS Glass Separator Line */}
        <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/40 to-transparent shrink-0 mx-0.5" />

        {/* CENTER: Enclosed Glass Capsule Enclosure */}
        <div className="relative z-10 flex-1 flex items-center justify-center min-w-0 px-0.5">
          <div className="w-full flex items-center justify-center bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)]">
            {isTTSActive ? (
              /* Inline TTS Player Suite */
              <div className="flex items-center gap-1 px-1.5 animate-in fade-in duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSPrev) onTTSPrev();
                  }}
                  className="p-1 rounded-full text-on-surface hover:text-primary bg-white/10 border border-primary/40 shadow-[0_2px_6px_rgba(0,0,0,0.25),_inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:bg-white/20 transition-all active:scale-90"
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
                    className="p-1.5 bg-primary/25 text-primary border border-primary/60 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-90 transition-all"
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
                    className="p-1.5 bg-primary/25 text-primary border border-primary/60 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-90 transition-all"
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
                  className="p-1 rounded-full text-on-surface hover:text-primary bg-white/10 border border-primary/40 shadow-[0_2px_6px_rgba(0,0,0,0.25),_inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:bg-white/20 transition-all active:scale-90"
                  title="Đoạn sau"
                >
                  <SkipForward size={15} />
                </button>

                <div className="w-[1px] h-3.5 bg-primary/40 mx-0.5" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSStop) onTTSStop();
                  }}
                  className="p-1 text-rose-400 hover:bg-rose-500/20 bg-rose-500/10 border border-rose-500/40 shadow-[0_2px_6px_rgba(0,0,0,0.25),_inset_0_1px_0.5px_rgba(255,255,255,0.3)] rounded-full transition-all active:scale-90"
                  title="Dừng đọc"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              </div>
            ) : chapters && chapters.length > 1 ? (
              /* Multi-Chapter Batch Mode: 3D Glass Segmented Control (100% Fit, Zero Clipping) */
              <div className="w-full flex items-center gap-1.5 min-w-0">
                {/* 3D Glass Menu List Button on Far Left (Pin Fixed) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChapterSelect();
                  }}
                  className="w-7 h-7 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0"
                  title="Mở danh sách tất cả các chương"
                >
                  <List size={14} strokeWidth={2.5} />
                </button>

                {/* Vertical Separator Line */}
                <div className="w-[1px] h-4.5 bg-primary/40 shrink-0" />

                {/* 3D Segmented Control Layout: Equal auto-cols-fr distribution (100% Fit, No Clipping) */}
                <div className="flex-1 min-w-0 grid grid-flow-col auto-cols-fr gap-1 items-center justify-center py-0.5">
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
                        className={`w-full py-1 px-0.5 rounded-full text-[10.5px] font-mono font-black tracking-tight flex items-center justify-center transition-all duration-150 cursor-pointer truncate ${
                          isActive
                            ? 'bg-primary/25 text-primary font-black border border-primary/60 shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] scale-[1.02]'
                            : 'bg-white/10 text-on-surface/90 font-mono font-bold border border-primary/40 shadow-[0_2px_6px_rgba(0,0,0,0.25),_inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:bg-white/20 active:scale-95'
                        }`}
                        title={
                          chap.title?.toLowerCase().startsWith('chương')
                            ? chap.title
                            : `Chương ${chap.chapterNumber}: ${chap.title}`
                        }
                      >
                        <span className="truncate">{chap.chapterNumber}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Single Chapter Mode */
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChapterSelect();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all active:scale-95 cursor-pointer font-mono font-black text-xs"
                title="Mở danh sách tất cả các chương"
              >
                <List size={14} strokeWidth={2.5} />
                <span>Ch. {currentChapterNumber !== undefined ? currentChapterNumber : '-'}</span>
                {totalChapters ? <span className="text-[10px] opacity-70">/{totalChapters}</span> : null}
              </button>
            )}
          </div>
        </div>

        {/* Vertical macOS Glass Separator Line */}
        <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/40 to-transparent shrink-0 mx-0.5" />

        {/* RIGHT GROUP: macOS Control Center Glass Spheres Capsule */}
        <div className="relative z-10 flex items-center gap-1.5 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)] shrink-0">
          {/* Quick TTS Activation / Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleTTS) {
                onToggleTTS();
              } else if (isTTSActive) {
                if (onTTSStop) onTTSStop();
              } else {
                if (onTTSPlay) onTTSPlay();
              }
            }}
            className={`w-8 h-8 rounded-full border transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
              isTTSActive
                ? 'bg-primary text-on-primary border-primary shadow-[0_3px_10px_rgba(59,130,246,0.5)] animate-pulse'
                : 'bg-white/10 border border-primary/50 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.3)] hover:bg-white/20'
            }`}
            title={isTTSActive ? 'Tắt đọc thành tiếng' : 'Bật đọc thành tiếng (VieNeu AI TTS)'}
          >
            <Volume2 size={17} />
          </button>

          {/* System Settings Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSettings('reader');
            }}
            className="w-8 h-8 rounded-full bg-white/10 border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:text-primary hover:rotate-45 hover:bg-white/20 transition-all duration-300 active:scale-90 cursor-pointer flex items-center justify-center"
            title="Cài đặt đọc sách"
          >
            <Settings size={17} />
          </button>

          {/* AI Translation Button (Online Only) */}
          {!isOfflineMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTranslation();
              }}
              className="w-8 h-8 rounded-full bg-primary/25 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] hover:bg-primary/35 transition-all active:scale-90 cursor-pointer flex items-center justify-center"
              title="Dịch AI"
            >
              <Sparkles size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
