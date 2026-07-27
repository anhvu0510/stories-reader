import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { useTTSStore } from '../stores/useTTSStore';

interface TTSControlBarProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TTSControlBar({ onPlay, onPause, onStop, onPrev, onNext }: TTSControlBarProps) {
  const { isPlaying, isPaused, currentParagraphIndex } = useTTSStore();

  if (!isPlaying && !isPaused) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 w-full max-w-md mx-auto px-4 animate-in slide-in-from-bottom-5 duration-200 pointer-events-none">
      <div className="bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/30 px-4 py-2 rounded-full shadow-2xl flex items-center justify-between pointer-events-auto transform-gpu transition-colors duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-mono font-extrabold text-primary">
            ĐOẠN {currentParagraphIndex >= 0 ? currentParagraphIndex + 1 : 1}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1.5 rounded-full text-on-surface hover:text-primary transition-colors active:scale-95"
            title="Đoạn trước"
          >
            <SkipBack size={16} />
          </button>

          {isPlaying ? (
            <button
              onClick={onPause}
              className="p-2.5 bg-primary text-on-primary rounded-full shadow-md transition-all active:scale-90"
              title="Tạm dừng"
            >
              <Pause size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="p-2.5 bg-primary text-on-primary rounded-full shadow-md transition-all active:scale-90"
              title="Tiếp tục đọc"
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}

          <button
            onClick={onNext}
            className="p-1.5 rounded-full text-on-surface hover:text-primary transition-colors active:scale-95"
            title="Đoạn sau"
          >
            <SkipForward size={16} />
          </button>

          <div className="w-[1px] h-4 bg-outline-variant/30 mx-1" />

          <button
            onClick={onStop}
            className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors active:scale-95"
            title="Dừng đọc"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
