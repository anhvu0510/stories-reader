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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/useAppStore';
import { useModalStore } from '../../../stores/useModalStore';

interface ReaderQuickControlProps {
  bookId: string;
  prevChapterId?: string;
  nextChapterId?: string;
  currentChapterNumber?: number;
  totalChapters?: number;
  isVisible?: boolean;
  isTTSActive?: boolean;
  isTTSPlaying?: boolean;
  currentParagraphIndex?: number;
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
  totalChapters,
  isVisible = true,
  isTTSActive = false,
  isTTSPlaying = false,
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
      className={`fixed bottom-4 left-0 right-0 z-50 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-all duration-300 transform-gpu ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container/95 backdrop-blur-md border border-outline-variant/30 shadow-2xl rounded-full px-3.5 py-2.5 flex items-center justify-between gap-3 sm:gap-4 pointer-events-auto transition-colors duration-200"
      >
        {/* LEFT GROUP: Pure Icon Prev & Next Buttons (Zero Text Labels) */}
        <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-full border border-outline-variant/20 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrev) {
                navigate(`/book/${bookId}/chapter/${prevChapterId}`);
              }
            }}
            disabled={!hasPrev}
            className={`p-2 rounded-full flex items-center justify-center transition-all ${
              hasPrev
                ? 'bg-surface-container-highest text-primary border border-primary/25 shadow-xs hover:bg-primary/20 active:scale-90 cursor-pointer opacity-100'
                : 'bg-surface-container-lowest/30 text-outline-variant/30 border border-outline-variant/10 opacity-30 cursor-not-allowed pointer-events-none'
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
            className={`p-2 rounded-full flex items-center justify-center transition-all ${
              hasNext
                ? 'bg-primary text-on-primary shadow-md hover:bg-primary-fixed active:scale-90 cursor-pointer opacity-100'
                : 'bg-surface-container-lowest/30 text-outline-variant/30 border border-outline-variant/10 opacity-30 cursor-not-allowed pointer-events-none'
            }`}
            title={hasNext ? 'Chương sau' : 'Đã ở chương mới nhất'}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-4.5 bg-white/25 shadow-xs shrink-0 mx-0.5" />

        {/* CENTER: Dynamic Mode (Normal Chapter Text vs Inline Read Aloud Controls) */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-1">
          {isTTSActive ? (
            /* Inline TTS Read Aloud Control Suite */
            <div className="flex items-center gap-1.5 bg-surface-container-highest/90 px-2.5 py-1 rounded-full border border-primary/30 shadow-sm animate-in fade-in duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSPrev) onTTSPrev();
                }}
                className="p-2 rounded-full text-on-surface hover:text-primary hover:bg-surface transition-colors active:scale-90"
                title="Đoạn trước"
              >
                <SkipBack size={16} />
              </button>

              {isTTSPlaying ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSPause) onTTSPause();
                  }}
                  className="p-2 bg-primary text-on-primary rounded-full shadow-md active:scale-90"
                  title="Tạm dừng"
                >
                  <Pause size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTTSPlay) onTTSPlay();
                  }}
                  className="p-2 bg-primary text-on-primary rounded-full shadow-md active:scale-90"
                  title="Tiếp tục đọc"
                >
                  <Play size={16} fill="currentColor" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSNext) onTTSNext();
                }}
                className="p-2 rounded-full text-on-surface hover:text-primary hover:bg-surface transition-colors active:scale-90"
                title="Đoạn sau"
              >
                <SkipForward size={16} />
              </button>

              {/* Distinct Separator Line */}
              <div className="w-[1px] h-4.5 bg-white/25 shadow-xs mx-1.5" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTTSStop) onTTSStop();
                }}
                className="p-2 text-error hover:bg-error/10 rounded-full transition-colors active:scale-90"
                title="Dừng đọc"
              >
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          ) : (
            /* Premium Glassmorphism Chapter Counter Pill Badge */
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChapterSelect();
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Mở bảng chọn chương"
            >
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary/75 font-mono">CHƯƠNG</span>
              <span className="text-xs font-black font-mono text-primary leading-none ml-0.5">
                {currentChapterNumber !== undefined ? currentChapterNumber : '-'}
              </span>
              {totalChapters ? (
                <span className="text-[10px] font-bold font-mono text-primary/60">
                  /{totalChapters}
                </span>
              ) : null}
            </button>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-4.5 bg-white/25 shadow-xs shrink-0 mx-0.5" />

        {/* RIGHT GROUP: Speaker Toggle (Hidden when active), System Settings & AI Translation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Read Aloud TTS Toggle Button (Hidden when TTS is active to yield slot) */}
          {onToggleTTS && !isTTSActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleTTS();
              }}
              className="p-2.5 rounded-full border bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-surface transition-all active:scale-95"
              title="Bật Đọc thành tiếng (Read Aloud)"
            >
              <Volume2 size={16} />
            </button>
          )}

          {/* System Settings Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSettings('reader');
            }}
            className="p-2.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-surface transition-all active:scale-95"
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
              className="p-2.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-primary hover:bg-surface transition-all active:scale-95"
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
