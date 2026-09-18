import { useState, useEffect, useRef, useMemo } from 'react';
import { useReaderConfigStore } from '../stores/useReaderConfigStore';
import { TTSService, DEFAULT_VIENEU_SERVER_URL } from '../services/ttsService';
import {
  EdgeTTSService,
  type EdgeSpeechWithBoundaries,
} from '../services/edgeTtsService';
import {
  buildSpeechSegments,
  GaplessTtsPlayer,
  splitParagraphIntoSentences,
  type SentenceChunk,
  WebAudioPlaybackEngine,
} from '../services/gaplessTtsPlayer';
import { DomWordHighlighter } from '../services/domWordHighlighter';
import { useAppStore } from '../stores/useAppStore';
import { ReadAloudScrollFollower } from '../services/readAloudScrollFollower';
import { useTTSStore } from '../features/reader/stores/useTTSStore';

export { splitParagraphIntoSentences } from '../services/gaplessTtsPlayer';

const WORD_HIGHLIGHT_CLASS = 'msreadout-word-highlight';
const VIENEU_SEGMENT_TARGET_CHARACTERS = 108;
const VIENEU_SEGMENT_MAX_CHARACTERS = 120;

export function useReadAloud(paragraphs: string[]) {
  const activeDomain = useAppStore((state) => state.activeDomain);
  const voiceUri = useReaderConfigStore((state) => state.voiceUri);
  const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
  const speechRate = useReaderConfigStore((state) => state.speechRate);
  const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
  const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const gaplessPlayerRef = useRef<GaplessTtsPlayer | null>(null);
  const wordHighlighterRef = useRef<DomWordHighlighter | null>(null);
  if (!wordHighlighterRef.current) {
    wordHighlighterRef.current = new DomWordHighlighter(WORD_HIGHLIGHT_CLASS);
  }
  const scrollFollowerRef = useRef<ReadAloudScrollFollower | null>(null);
  if (!scrollFollowerRef.current) {
    scrollFollowerRef.current = new ReadAloudScrollFollower();
  }
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentChunkIdxRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playSessionIdRef = useRef<number>(0);
  const charIndexRef = useRef(-1);
  const charLengthRef = useRef(0);

  const chunks = useMemo(() => {
    const res: SentenceChunk[] = [];
    const isVieneu = ttsEngine === 'vieneu';
    const splitOptions = isVieneu
      ? { maxCharacters: VIENEU_SEGMENT_MAX_CHARACTERS }
      : undefined;
    paragraphs.forEach((html, pIdx) => {
      if (!html) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent || tmp.innerText || '';

      if (text.trim()) {
        const sentenceChunks = splitParagraphIntoSentences(text, pIdx, splitOptions);
        res.push(...sentenceChunks);
      }
    });
    return buildSpeechSegments(
      res,
      isVieneu
        ? {
            targetCharacters: VIENEU_SEGMENT_TARGET_CHARACTERS,
            maxCharacters: VIENEU_SEGMENT_MAX_CHARACTERS,
          }
        : undefined
    );
  }, [paragraphs, ttsEngine]);

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
      currentCharIndex: charIndexRef.current,
      currentCharLength: charLengthRef.current,
    });
  }, [isPlaying, isPaused, activeParagraphIndex]);

  const edgeAudioRef = useRef<HTMLAudioElement | null>(null);
  const edgeAudioUrlRef = useRef<string | null>(null);
  const edgeBoundaryFrameRef = useRef<number | null>(null);
  const edgeRequestAbortRef = useRef<AbortController | null>(null);

  const stopEdgeBoundaryTracking = () => {
    if (edgeBoundaryFrameRef.current !== null) {
      window.cancelAnimationFrame(edgeBoundaryFrameRef.current);
      edgeBoundaryFrameRef.current = null;
    }
  };

  const releaseEdgeAudio = () => {
    stopEdgeBoundaryTracking();
    const audio = edgeAudioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onpause = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      edgeAudioRef.current = null;
    }
    if (edgeAudioUrlRef.current) {
      URL.revokeObjectURL(edgeAudioUrlRef.current);
      edgeAudioUrlRef.current = null;
    }
  };

  const stopAudioPlayer = () => {
    edgeRequestAbortRef.current?.abort();
    edgeRequestAbortRef.current = null;
    edgePrefetchCacheRef.current.clear();
    releaseEdgeAudio();
    const player = gaplessPlayerRef.current;
    gaplessPlayerRef.current = null;
    if (player) {
      void player.dispose().catch((error: unknown) => {
        console.warn('Failed to dispose VieNeu audio player:', error);
      });
    }
  };

  const edgePrefetchCacheRef = useRef<Map<number, Promise<EdgeSpeechWithBoundaries>>>(new Map());

  const prefetchEdgeChunk = (index: number) => {
    if (index < 0 || index >= chunks.length) return;
    if (edgePrefetchCacheRef.current.has(index)) return;
    const chunk = chunks[index];
    if (!chunk || !chunk.text.trim()) return;
    if (!edgeRequestAbortRef.current || edgeRequestAbortRef.current.signal.aborted) {
      edgeRequestAbortRef.current = new AbortController();
    }

    const promise = EdgeTTSService.synthesizeSpeechWithBoundaries(
      chunk.text,
      edgeVoiceUri,
      speechRate,
      activeDomain?.url,
      edgeRequestAbortRef.current.signal
    ).catch((err) => {
      edgePrefetchCacheRef.current.delete(index);
      throw err;
    });
    edgePrefetchCacheRef.current.set(index, promise);
  };

  const playChunkViaEdge = (index: number, sessionId: number) => {
    if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
    if (index >= chunks.length) {
      stopReading();
      return;
    }

    currentChunkIdxRef.current = index;
    setCurrentChunkIndex(index);

    const chunk = chunks[index];
    if (!chunk || !chunk.text.trim()) {
      playChunkViaEdge(index + 1, sessionId);
      return;
    }

    releaseEdgeAudio();

    // Put the audio the listener needs now at the front of the server's
    // serialized Edge TTS queue. Starting speculative requests first can add
    // multiple synthesis windows to initial playback latency.
    prefetchEdgeChunk(index);
    const fetchPromise = edgePrefetchCacheRef.current.get(index);
    if (!fetchPromise) {
      playChunkViaBrowser(index, 0, sessionId);
      return;
    }

    // Prefetch upcoming chunks only after the current request is in flight.
    prefetchEdgeChunk(index + 1);
    prefetchEdgeChunk(index + 2);

    // Clean old prefetch entries
    for (const k of edgePrefetchCacheRef.current.keys()) {
      if (k < index) edgePrefetchCacheRef.current.delete(k);
    }

    fetchPromise
      .then(({ audio: blob, wordBoundaries }) => {
        if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        edgeAudioRef.current = audio;
        edgeAudioUrlRef.current = audioUrl;
        let nextBoundaryIndex = 0;

        const syncWordBoundary = () => {
          if (
            edgeAudioRef.current !== audio ||
            !isPlayingRef.current ||
            playSessionIdRef.current !== sessionId
          ) {
            return;
          }

          let activeBoundary = null as (typeof wordBoundaries)[number] | null;
          while (
            nextBoundaryIndex < wordBoundaries.length &&
            wordBoundaries[nextBoundaryIndex].startSeconds <= audio.currentTime
          ) {
            activeBoundary = wordBoundaries[nextBoundaryIndex];
            nextBoundaryIndex += 1;
          }
          if (activeBoundary) {
            updateWordHighlight(
              index,
              activeBoundary.charIndex,
              activeBoundary.charLength
            );
          }
        };
        const startBoundaryTracking = () => {
          stopEdgeBoundaryTracking();
          const tick = () => {
            syncWordBoundary();
            if (
              edgeAudioRef.current === audio &&
              !audio.paused &&
              !audio.ended &&
              playSessionIdRef.current === sessionId
            ) {
              edgeBoundaryFrameRef.current = window.requestAnimationFrame(tick);
            } else {
              edgeBoundaryFrameRef.current = null;
            }
          };
          edgeBoundaryFrameRef.current = window.requestAnimationFrame(tick);
        };

        audio.ontimeupdate = syncWordBoundary;
        audio.onplay = startBoundaryTracking;
        audio.onpause = stopEdgeBoundaryTracking;

        audio.onended = () => {
          stopEdgeBoundaryTracking();
          if (edgeAudioRef.current === audio) edgeAudioRef.current = null;
          if (edgeAudioUrlRef.current === audioUrl) edgeAudioUrlRef.current = null;
          URL.revokeObjectURL(audioUrl);
          if (isPlayingRef.current && playSessionIdRef.current === sessionId) {
            playChunkViaEdge(index + 1, sessionId);
          }
        };

        audio.onerror = (err) => {
          if (playSessionIdRef.current !== sessionId) return;
          stopEdgeBoundaryTracking();
          if (edgeAudioRef.current === audio) edgeAudioRef.current = null;
          if (edgeAudioUrlRef.current === audioUrl) edgeAudioUrlRef.current = null;
          URL.revokeObjectURL(audioUrl);
          console.warn('[Edge TTS] Playback error, fallback to browser voice:', err);
          playChunkViaBrowser(index, 0, sessionId);
        };

        audio.play().catch((err) => {
          if (playSessionIdRef.current !== sessionId) return;
          releaseEdgeAudio();
          console.warn('[Edge TTS] Audio play error:', err);
          playChunkViaBrowser(index, 0, sessionId);
        });
      })
      .catch((err) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[Edge TTS] Synthesis error, fallback to browser voice:', err);
        playChunkViaBrowser(index, 0, sessionId);
      });
  };

  const playChunk = (index: number, startOffset: number = 0) => {
    const sessionId = playSessionIdRef.current;
    if (ttsEngine === 'browser') {
      playChunkViaBrowser(index, startOffset, sessionId);
    } else if (ttsEngine === 'edge') {
      playChunkViaEdge(index, sessionId);
    } else {
      playChunkViaVieNeu(index, sessionId);
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
    scrollFollowerRef.current?.cancel();
    if (synth) synth.cancel();

    currentChunkIdxRef.current = 0;
    setCurrentChunkIndex(-1);
    charIndexRef.current = -1;
    charLengthRef.current = 0;
    useTTSStore.setState({ currentCharIndex: -1, currentCharLength: 0 });
  };

  useEffect(() => {
    stopReading();
  }, [paragraphs]);

  const lastInteractionTime = useRef(0);

  useEffect(() => {
    const onInteraction = () => {
      lastInteractionTime.current = Date.now();
      scrollFollowerRef.current?.cancel();
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

  const updateWordHighlight = (chunkIndex: number, nextCharIndex: number, nextCharLength: number) => {
    const highlighter = wordHighlighterRef.current;
    if (!highlighter || !chunks[chunkIndex]) return;

    const readerContent = document.querySelector('#main-story-content');
    if (!readerContent) {
      highlighter.clear();
      return;
    }

    const chunk = chunks[chunkIndex];
    const pNode = readerContent.querySelector<HTMLElement>(
      `article > div[data-paragraph-index="${chunk.pIdx}"]`
    );
    if (!pNode || nextCharIndex < 0 || nextCharLength <= 0) {
      highlighter.clear();
      return;
    }

    const wordText = chunk.text.substring(nextCharIndex, nextCharIndex + nextCharLength);
    const match = wordText.match(/[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/);
    if (!match || match.index === undefined) {
      return;
    }

    charIndexRef.current = nextCharIndex;
    charLengthRef.current = nextCharLength;
    useTTSStore.setState({
      currentParagraphIndex: chunk.pIdx,
      currentCharIndex: nextCharIndex,
      currentCharLength: nextCharLength,
    });

    const offset = nextCharIndex + match.index;
    const geometry = highlighter.highlight(pNode, chunk.startOffset + offset, match[0].length);
    if (geometry && Date.now() - lastInteractionTime.current > 3000) {
      scrollFollowerRef.current?.follow(geometry.line);
    }
  };

  useEffect(() => {
    return () => {
      wordHighlighterRef.current?.dispose();
      scrollFollowerRef.current?.cancel();
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
    charIndexRef.current = startOffset;
    charLengthRef.current = 0;
    wordHighlighterRef.current?.clear();

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
        updateWordHighlight(index, startOffset + e.charIndex, e.charLength);
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
      onSegmentStart: (relativeIndex) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        activeIndex = index + relativeIndex;
      },
      onWordBoundary: (relativeIndex, _segment, cue) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        activeIndex = index + relativeIndex;
        if (currentChunkIdxRef.current !== activeIndex) {
          currentChunkIdxRef.current = activeIndex;
          setCurrentChunkIndex(activeIndex);
        }
        updateWordHighlight(activeIndex, cue.charIndex, cue.charLength);
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
      } else if (ttsEngine === 'edge' && edgeAudioRef.current) {
        void edgeAudioRef.current.play().catch(() => playChunk(currentChunkIdxRef.current));
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
    } else if (ttsEngine === 'edge') {
      edgeAudioRef.current?.pause();
    }
  };

  const nextSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current < chunks.length - 1) {
      const nextIdx = currentChunkIdxRef.current + 1;
      playSessionIdRef.current += 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      currentChunkIdxRef.current = nextIdx;
      playChunk(nextIdx);
    } else {
      stopReading();
    }
  };

  const prevSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current > 0) {
      const prevIdx = currentChunkIdxRef.current - 1;
      playSessionIdRef.current += 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      currentChunkIdxRef.current = prevIdx;
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
      playSessionIdRef.current += 1;
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
