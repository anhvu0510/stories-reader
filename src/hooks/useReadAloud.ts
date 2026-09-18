import { useState, useEffect, useRef, useMemo } from 'react';
import { useReaderConfigStore } from '../stores/useReaderConfigStore';
import { TTSService, DEFAULT_VIENEU_SERVER_URL } from '../services/ttsService';
import {
  buildSpeechSegments,
  GaplessTtsPlayer,
  splitParagraphIntoSentences,
  type SentenceChunk,
  WebAudioPlaybackEngine,
} from '../services/gaplessTtsPlayer';
import { DomWordHighlighter } from '../services/domWordHighlighter';
import { useTTSStore } from '../features/reader/stores/useTTSStore';

export { splitParagraphIntoSentences } from '../services/gaplessTtsPlayer';

const WORD_HIGHLIGHT_CLASS = 'msreadout-word-highlight';

export function useReadAloud(paragraphs: string[]) {
  const voiceUri = useReaderConfigStore((state) => state.voiceUri);
  const speechRate = useReaderConfigStore((state) => state.speechRate);
  const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
  const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [charIndex, setCharIndex] = useState(-1);
  const [charLength, setCharLength] = useState(0);

  const gaplessPlayerRef = useRef<GaplessTtsPlayer | null>(null);
  const wordHighlighterRef = useRef<DomWordHighlighter | null>(null);
  if (!wordHighlighterRef.current) {
    wordHighlighterRef.current = new DomWordHighlighter(WORD_HIGHLIGHT_CLASS);
  }
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentChunkIdxRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playSessionIdRef = useRef<number>(0);

  const chunks = useMemo(() => {
    const res: SentenceChunk[] = [];
    paragraphs.forEach((html, pIdx) => {
      if (!html) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent || tmp.innerText || '';

      if (text.trim()) {
        const sentenceChunks = splitParagraphIntoSentences(text, pIdx);
        res.push(...sentenceChunks);
      }
    });
    return buildSpeechSegments(res);
  }, [paragraphs]);

  const activeParagraphIndex =
    currentChunkIndex >= 0 && chunks[currentChunkIndex]
      ? chunks[currentChunkIndex].pIdx
      : -1;

  // Sync state with global useTTSStore
  useEffect(() => {
    useTTSStore.setState({
      isPlaying,
      isPaused,
      currentParagraphIndex: activeParagraphIndex,
      currentCharIndex: charIndex,
      currentCharLength: charLength,
    });
  }, [isPlaying, isPaused, activeParagraphIndex, charIndex, charLength]);

  const stopAudioPlayer = () => {
    const player = gaplessPlayerRef.current;
    gaplessPlayerRef.current = null;
    if (player) {
      void player.dispose().catch((error: unknown) => {
        console.warn('Failed to dispose VieNeu audio player:', error);
      });
    }
  };

  const stopReading = () => {
    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = false;
    isPausedRef.current = false;
    playSessionIdRef.current += 1;

    stopAudioPlayer();
    wordHighlighterRef.current?.clear();
    if (synth) synth.cancel();

    currentChunkIdxRef.current = 0;
    setCurrentChunkIndex(-1);
    setCharIndex(-1);
    setCharLength(0);
  };

  useEffect(() => {
    stopReading();
  }, [paragraphs]);

  const lastInteractionTime = useRef(0);

  useEffect(() => {
    const onInteraction = () => {
      lastInteractionTime.current = Date.now();
    };
    window.addEventListener('wheel', onInteraction, { passive: true });
    window.addEventListener('touchmove', onInteraction, { passive: true });
    window.addEventListener('mousedown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction, { passive: true });
    return () => {
      window.removeEventListener('wheel', onInteraction);
      window.removeEventListener('touchmove', onInteraction);
      window.removeEventListener('mousedown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, []);

  // Handle Highlighting directly on the ReaderScreen DOM elements
  useEffect(() => {
    const highlighter = wordHighlighterRef.current;
    if (!highlighter) return;

    const readerContent = document.querySelector('#main-story-content');
    if (!readerContent || currentChunkIndex === -1 || !chunks[currentChunkIndex]) {
      highlighter.clear();
      return;
    }

    const chunk = chunks[currentChunkIndex];
    const pNode = readerContent.querySelector<HTMLElement>(
      `article > div[data-paragraph-index="${chunk.pIdx}"]`
    );
    if (!pNode || charIndex < 0 || charLength <= 0) {
      highlighter.clear();
      return;
    }

    const wordText = chunk.text.substring(charIndex, charIndex + charLength);
    const match = wordText.match(/[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/);
    if (!match || match.index === undefined) {
      highlighter.clear();
      return;
    }

    const offset = charIndex + match.index;
    highlighter.highlight(pNode, chunk.startOffset + offset, match[0].length);

    const activeLine = document.querySelector<HTMLElement>('.msreadout-line-highlight');
    if (activeLine && Date.now() - lastInteractionTime.current > 3000) {
      const rect = activeLine.getBoundingClientRect();
      const safeBandTop = window.innerHeight * 0.25;
      const safeBandBottom = window.innerHeight * 0.75;
      if (rect.top < safeBandTop || rect.bottom > safeBandBottom) {
        const prefersReducedMotion = window.matchMedia?.(
          '(prefers-reduced-motion: reduce)'
        ).matches;
        activeLine.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentChunkIndex, charIndex, charLength, chunks]);

  useEffect(() => {
    return () => {
      wordHighlighterRef.current?.clear();
      stopReading();
    };
  }, []);

  const playChunkViaBrowser = (index: number, startOffset: number = 0, sessionId: number) => {
    if (!synth || !isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
    if (index >= chunks.length) {
      stopReading();
      return;
    }

    currentChunkIdxRef.current = index;
    setCurrentChunkIndex(index);
    setCharIndex(startOffset);
    setCharLength(0);

    const chunk = chunks[index];
    const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

    if (!textToSpeak.trim()) {
      playChunkViaBrowser(index + 1, 0, sessionId);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;

    const voices = synth.getVoices();
    const selectedVoice = voices.find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onboundary = (e) => {
      if (playSessionIdRef.current !== sessionId) return;
      if (e.name === 'word') {
        setCharIndex(startOffset + e.charIndex);
        setCharLength(e.charLength);
      }
    };

    utterance.onend = () => {
      if (playSessionIdRef.current !== sessionId) return;
      if (isPlayingRef.current && !isPausedRef.current) {
        playChunk(index + 1, 0);
      }
    };

    utterance.onerror = (e) => {
      if (playSessionIdRef.current !== sessionId) return;
      if (e.error === 'canceled') return;
      console.warn('Browser SpeechSynthesis error:', e.error);
      if (isPlayingRef.current && !isPausedRef.current) {
        playChunk(index + 1, 0);
      }
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const playChunkViaVieNeu = (index: number, sessionId: number) => {
    if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
    if (index >= chunks.length) {
      stopReading();
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      console.warn('Web Audio API is unavailable, falling back to browser voice.');
      playChunkViaBrowser(index, 0, sessionId);
      return;
    }

    stopAudioPlayer();
    const audioContext = new AudioContextConstructor();
    const activeVoice = voiceUri || 'Minh Quân';
    let activeIndex = index;
    const player = new GaplessTtsPlayer({
      engine: new WebAudioPlaybackEngine(audioContext),
      speechRate,
      synthesize: (segment, signal) =>
        TTSService.synthesizeSpeech(
          segment.text,
          activeVoice,
          speechRate,
          vieneuServerUrl,
          signal
        ),
      stream: (segment, signal) =>
        TTSService.streamSpeech(
          segment.text,
          activeVoice,
          speechRate,
          vieneuServerUrl,
          signal
        ),
    });
    gaplessPlayerRef.current = player;

    player.start(chunks.slice(index), {
      onSegmentStart: (relativeIndex, segment) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        activeIndex = index + relativeIndex;
        currentChunkIdxRef.current = activeIndex;
        setCurrentChunkIndex(activeIndex);
        setCharIndex(-1);
        setCharLength(0);
      },
      onWordBoundary: (relativeIndex, _segment, cue) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        activeIndex = index + relativeIndex;
        currentChunkIdxRef.current = activeIndex;
        setCurrentChunkIndex(activeIndex);
        setCharIndex(cue.charIndex);
        setCharLength(cue.charLength);
      },
      onFinished: () => {
        if (playSessionIdRef.current !== sessionId) return;
        gaplessPlayerRef.current = null;
        void player.dispose();
        stopReading();
      },
      onError: (error: unknown) => {
        if (playSessionIdRef.current !== sessionId) return;
        console.warn('VieNeu TTS playback failed, falling back to browser voice:', error);
        gaplessPlayerRef.current = null;
        void player.dispose();
        playChunkViaBrowser(activeIndex, 0, sessionId);
      },
    });
  };

  const playChunk = (index: number, startOffset: number = 0) => {
    const sessionId = playSessionIdRef.current;
    if (ttsEngine === 'browser') {
      playChunkViaBrowser(index, startOffset, sessionId);
    } else {
      playChunkViaVieNeu(index, sessionId);
    }
  };

  const startReading = () => {
    if (isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      isPausedRef.current = false;

      if (ttsEngine === 'vieneu' && gaplessPlayerRef.current) {
        void gaplessPlayerRef.current
          .resume()
          .catch(() => playChunk(currentChunkIdxRef.current));
      } else if (ttsEngine === 'browser' && synth) {
        synth.resume();
      } else {
        playChunk(currentChunkIdxRef.current);
      }
      return;
    }

    const newSessionId = playSessionIdRef.current + 1;
    playSessionIdRef.current = newSessionId;

    stopAudioPlayer();
    if (synth) synth.cancel();

    setIsPlaying(true);
    setIsPaused(false);
    isPlayingRef.current = true;
    isPausedRef.current = false;

    if (currentChunkIdxRef.current >= chunks.length) {
      currentChunkIdxRef.current = 0;
    }
    playChunk(currentChunkIdxRef.current);
  };

  const pauseReading = () => {
    setIsPlaying(false);
    setIsPaused(true);
    isPlayingRef.current = false;
    isPausedRef.current = true;

    if (gaplessPlayerRef.current) {
      void gaplessPlayerRef.current.pause();
    }
    if (ttsEngine === 'browser' && synth) {
      synth.pause();
    }
  };

  const nextSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current < chunks.length - 1) {
      const nextIdx = currentChunkIdxRef.current + 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      playChunk(nextIdx);
    } else {
      stopReading();
    }
  };

  const prevSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current > 0) {
      const prevIdx = currentChunkIdxRef.current - 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      playChunk(prevIdx);
    } else {
      stopReading();
    }
  };

  const jumpToContent = (pIdx: number, textOffset: number = 0) => {
    let targetIndex = chunks.findIndex(
      (c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length
    );
    if (targetIndex === -1) {
      targetIndex = chunks.findIndex((c) => c.pIdx === pIdx);
    }

    if (targetIndex !== -1) {
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      currentChunkIdxRef.current = targetIndex;
      playChunk(targetIndex, textOffset);
    }
  };

  return {
    isPlaying,
    isPaused,
    currentChunkIndex,
    activeParagraphIndex,
    startReading,
    pauseReading,
    stopReading,
    nextSection,
    prevSection,
    jumpToContent,
  };
}
