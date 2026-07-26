import { create } from 'zustand';

interface TTSStore {
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraphIndex: number;
  currentCharIndex: number;
  currentCharLength: number;

  setIsPlaying: (playing: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setTTSPosition: (pIdx: number, charIdx: number, charLen: number) => void;
  resetTTS: () => void;
}

export const useTTSStore = create<TTSStore>((set) => ({
  isPlaying: false,
  isPaused: false,
  currentParagraphIndex: -1,
  currentCharIndex: -1,
  currentCharLength: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setTTSPosition: (currentParagraphIndex, currentCharIndex, currentCharLength) =>
    set({ currentParagraphIndex, currentCharIndex, currentCharLength }),
  resetTTS: () =>
    set({
      isPlaying: false,
      isPaused: false,
      currentParagraphIndex: -1,
      currentCharIndex: -1,
      currentCharLength: 0,
    }),
}));
