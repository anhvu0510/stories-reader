import { useState, useEffect, useRef, useMemo } from 'react';
import { useReaderConfigStore } from '../stores/useReaderConfigStore';
import { TTSService, DEFAULT_VIENEU_SERVER_URL } from '../services/ttsService';
import {
  EdgeTTSService,
  type EdgeSpeechWithBoundaries,
} from '../services/edgeTtsService';
import {
  GaplessTtsPlayer,
  splitByDatabaseBoundaries,
  type SentenceChunk,
  WebAudioPlaybackEngine,
} from '../services/gaplessTtsPlayer';
import { DomWordHighlighter } from '../services/domWordHighlighter';
import { useAppStore } from '../stores/useAppStore';
import { ReadAloudScrollFollower } from '../services/readAloudScrollFollower';
import { useTTSStore } from '../features/reader/stores/useTTSStore';
import { BackgroundAudioKeepAlive } from '../services/backgroundAudioKeepAlive';

export { splitParagraphIntoSentences } from '../services/gaplessTtsPlayer';

const WORD_HIGHLIGHT_CLASS = 'msreadout-word-highlight';
// Keep a grouped source line in one request whenever possible. The API accepts
// up to 512 chars; 480 leaves headroom for request normalization.

export function useReadAloud(paragraphs: string[]) {
  const activeDomain = useAppStore((state) => state.activeDomain);
  const voiceUri = useReaderConfigStore((state) => state.voiceUri);
  const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
  const speechRate = useReaderConfigStore((state) => state.speechRate);
  const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
  const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);
  const vieneuModel = useReaderConfigStore((state) => state.vieneuModel || undefined);
  const vieneuTemperature = useReaderConfigStore((state) => state.vieneuTemperature ?? 0.8);
  const vieneuTopK = useReaderConfigStore((state) => state.vieneuTopK ?? 25);
  const vieneuTopP = useReaderConfigStore((state) => state.vieneuTopP ?? 0.95);
  const vieneuMaxNewFrames = useReaderConfigStore((state) => state.vieneuMaxNewFrames ?? 300);
  const vieneuRepetitionPenalty = useReaderConfigStore((state) => state.vieneuRepetitionPenalty ?? 1.2);
  const vieneuRepetitionWindow = useReaderConfigStore((state) => state.vieneuRepetitionWindow ?? 80);
  const vieneuSteps = useReaderConfigStore((state) => state.vieneuSteps ?? 8);
  const vieneuCfg = useReaderConfigStore((state) => state.vieneuCfg ?? 2.0);
  const vieneuSway = useReaderConfigStore((state) => state.vieneuSway ?? -1.0);
  const vieneuMaxChars = useReaderConfigStore((state) => state.vieneuMaxChars ?? 140);
  const vieneuDenoise = useReaderConfigStore((state) => state.vieneuDenoise ?? true);
  const vieneuUseRefCodes = useReaderConfigStore((state) => state.vieneuUseRefCodes ?? true);
  const vieneuApplyWatermark = useReaderConfigStore((state) => state.vieneuApplyWatermark ?? true);
  const vieneuOutputSampleRate = useReaderConfigStore((state) => state.vieneuOutputSampleRate ?? 0);
  const vieneuOptions = useMemo(() => ({
    temperature: vieneuTemperature, top_k: vieneuTopK, top_p: vieneuTopP,
    max_new_frames: vieneuMaxNewFrames, repetition_penalty: vieneuRepetitionPenalty,
    repetition_window: vieneuRepetitionWindow, steps: vieneuSteps, cfg: vieneuCfg,
    sway: vieneuSway, max_chars: vieneuMaxChars, denoise: vieneuDenoise,
    use_ref_codes: vieneuUseRefCodes, apply_watermark: vieneuApplyWatermark,
    ...(vieneuOutputSampleRate ? { output_sample_rate: vieneuOutputSampleRate as 24000 | 48000 } : {}),
  }), [vieneuTemperature, vieneuTopK, vieneuTopP, vieneuMaxNewFrames, vieneuRepetitionPenalty, vieneuRepetitionWindow, vieneuSteps, vieneuCfg, vieneuSway, vieneuMaxChars, vieneuDenoise, vieneuUseRefCodes, vieneuApplyWatermark, vieneuOutputSampleRate]);

  const getVieneuOptionsForSegment = (text: string) => ({
    ...vieneuOptions,
    // max_chars is also used by the model as its text budget. Never let the
    // configured default truncate a complete source line selected by marker.
    max_chars: Math.min(512, Math.max(vieneuOptions.max_chars ?? 140, text.length)),
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
  const backgroundAudioRef = useRef<BackgroundAudioKeepAlive | null>(null);
  if (!backgroundAudioRef.current) {
    backgroundAudioRef.current = new BackgroundAudioKeepAlive();
  }

  const currentChunkIdxRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playSessionIdRef = useRef<number>(0);
  const charIndexRef = useRef(-1);
  const charLengthRef = useRef(0);

  const chunks = useMemo(() => {
    const res: SentenceChunk[] = [];
    paragraphs.forEach((html, pIdx) => {
      if (!html) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent || tmp.innerText || '';

      if (text.trim()) {
        // Paragraphs are already sentence units from getChapterContent. The
        // only valid subdivision is the invisible DB grouping delimiter.
        const sentenceChunks = splitByDatabaseBoundaries(text, pIdx);
        res.push(...sentenceChunks);
      }
    });
    return res.map((sentence, sentenceIndex) => ({
      ...sentence,
      sentenceStartIndex: sentenceIndex,
      sentenceEndIndex: sentenceIndex,
    }));
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
      isLoading,
      currentParagraphIndex: activeParagraphIndex,
      currentCharIndex: charIndexRef.current,
      currentCharLength: charLengthRef.current,
    });
  }, [isPlaying, isPaused, isLoading, activeParagraphIndex]);

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
        audio.onplay = () => {
          if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
            setIsLoading(false);
            setIsPlaying(true);
          }
          startBoundaryTracking();
        };
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
    setIsLoading(false);
    isPlayingRef.current = false;
    isPausedRef.current = false;
    playSessionIdRef.current += 1;

    stopAudioPlayer();
    backgroundAudioRef.current?.stop();
    wordHighlighterRef.current?.clear();
    scrollFollowerRef.current?.cancel();
    if (synth) synth.cancel();

    currentChunkIdxRef.current = 0;
    setCurrentChunkIndex(-1);
    charIndexRef.current = -1;
    charLengthRef.current = 0;
    useTTSStore.setState({ currentCharIndex: -1, currentCharLength: 0, isLoading: false });
  };

  useEffect(() => {
    stopReading();
  }, [paragraphs]);

  useEffect(() => {
    if (ttsEngine === 'vieneu') {
      stopReading();
    }
  }, [vieneuModel, voiceUri, ttsEngine, speechRate, vieneuOptions]);

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

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!isPlayingRef.current || isPausedRef.current) return;

      backgroundAudioRef.current?.resume();
      if (ttsEngine === 'vieneu') {
        void gaplessPlayerRef.current?.resume().catch(() => {});
      } else if (ttsEngine === 'edge') {
        void edgeAudioRef.current?.play().catch(() => {});
      } else {
        synth?.resume();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
    };
  }, [ttsEngine, synth]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;
    mediaSession.metadata = new MediaMetadata({ title: 'VietNeu Read Aloud' });
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => startReading()],
      ['pause', () => pauseReading()],
      ['nexttrack', () => nextSection()],
      ['previoustrack', () => prevSection()],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but do not support every action.
      }
    });
    return () => {
      handlers.forEach(([action]) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unsupported action cleanup.
        }
      });
    };
  }, [chunks.length]);

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

    utterance.onstart = () => {
      if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
        setIsLoading(false);
        setIsPlaying(true);
      }
    };

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
    const activeVoice = voiceUri || undefined;
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
          signal,
          vieneuModel,
          getVieneuOptionsForSegment(segment.text)
        ),
      stream: (segment, signal) =>
        TTSService.streamSpeech(
          segment.text,
          activeVoice,
          speechRate,
          vieneuServerUrl,
          signal,
          vieneuModel,
          getVieneuOptionsForSegment(segment.text)
        ),
      // Warm the complete next source paragraph while the current one plays.
      // This avoids waiting on sentence 2+ without issuing requests for the
      // entire chapter at startup. The second paragraph provides a safety
      // buffer when this private VPS has a transiently slower inference turn.
      prefetchByParagraph: true,
      prefetchParagraphsAhead: 2,
    });
    gaplessPlayerRef.current = player;

    player.start(chunks.slice(index), {
      onSegmentStart: (relativeIndex) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        setIsLoading(false);
        setIsPlaying(true);
        activeIndex = index + relativeIndex;
      },
      onWordBoundary: (relativeIndex, _segment, cue) => {
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
        setIsLoading(false);
        setIsPlaying(true);
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
      setIsLoading(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      backgroundAudioRef.current?.start();

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

    setIsLoading(true);
    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = true;
    isPausedRef.current = false;
    backgroundAudioRef.current?.start();

    if (currentChunkIdxRef.current >= chunks.length) {
      currentChunkIdxRef.current = 0;
    }
    playChunk(currentChunkIdxRef.current);
  };

  const pauseReading = () => {
    setIsPlaying(false);
    setIsPaused(true);
    setIsLoading(false);
    isPlayingRef.current = false;
    isPausedRef.current = true;
    backgroundAudioRef.current?.stop();

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

      setIsLoading(true);
      setIsPlaying(false);
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

      setIsLoading(true);
      setIsPlaying(false);
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

      setIsLoading(true);
      setIsPlaying(false);
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
    isLoading,
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
