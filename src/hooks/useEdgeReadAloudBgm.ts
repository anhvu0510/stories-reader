import { useEffect, useRef, useCallback, useState } from 'react';
import { BackgroundAudioKeepAlive } from '../services/backgroundAudioKeepAlive';

export interface EdgeReadAloudBgmOptions {
  audioUrl: string;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  stopDelayMs?: number;
  enabled?: boolean;
}

export interface EdgeReadAloudBgmReturn {
  isPlaying: boolean;
  toggleBgm: () => void;
  startBgm: (manual?: boolean) => void;
  stopBgm: (immediate?: boolean) => void;
}

export const EDGE_READ_ALOUD_SELECTOR =
  '.msreadout-line-highlight, .msreadout-word-highlight, .msreadout-highlight, msreadoutspan, [class*="msreadout"], [data-readout-highlight]';

export const EDGE_READ_ALOUD_INACTIVE_SELECTOR =
  '.msreadout-inactive-highlight, .msreadout-inactive-line-highlight, [class*="inactive-highlight"]';

export function isEdgeReadAloudActive(root: ParentNode = document): boolean {
  const hasInactive = Boolean(root.querySelector(EDGE_READ_ALOUD_INACTIVE_SELECTOR));
  if (hasInactive) return false;

  return Boolean(root.querySelector(EDGE_READ_ALOUD_SELECTOR));
}

/**
 * Creates a soft 4-second synthesized ambient loop (C-major chord)
 * to guarantee background music plays even if a physical MP3 file is missing or 0-byte.
 */
function createSynthesizedAmbientBuffer(ctx: AudioContext): AudioBuffer | null {
  if (typeof ctx.createBuffer !== 'function') return null;
  const sampleRate = ctx.sampleRate || 44100;
  const duration = 4.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  if (!buffer || typeof buffer.getChannelData !== 'function') return null;

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.15;
    const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.12;
    const note3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.10;
    const wave = (note1 + note2 + note3) * lfo;

    left[i] = wave;
    right[i] = wave;
  }

  return buffer;
}

export function useEdgeReadAloudBgm({
  audioUrl,
  volume = 0.2,
  fadeInMs = 500,
  fadeOutMs = 800,
  stopDelayMs = 1500,
  enabled = true,
}: EdgeReadAloudBgmOptions): EdgeReadAloudBgmReturn {
  const [isPlayingState, setIsPlayingState] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isPlayingRef = useRef(false);
  const isManualPlayingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundAudioRef = useRef<BackgroundAudioKeepAlive | null>(null);

  if (!backgroundAudioRef.current && typeof window !== 'undefined') {
    backgroundAudioRef.current = new BackgroundAudioKeepAlive();
  }

  // Helper to ensure AudioContext is unlocked by browser/mobile autoplay policy
  const getOrCreateAudioContext = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      return audioCtxRef.current;
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  const startBgm = useCallback(
    (manual = false) => {
      if (manual) {
        isManualPlayingRef.current = true;
      }

      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }

      const ctx = getOrCreateAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        void ctx.resume().catch((err) => {
          console.warn('[EdgeBgm] Could not resume AudioContext (autoplay restriction):', err);
        });
      }

      // Start mobile background audio keep alive
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.start();
        backgroundAudioRef.current.resume();
      }

      let buffer = audioBufferRef.current;
      if (!buffer || buffer.duration < 0.1) {
        buffer = createSynthesizedAmbientBuffer(ctx);
        audioBufferRef.current = buffer;
      }

      if (isPlayingRef.current && gainNodeRef.current) {
        const gain = gainNodeRef.current;
        const now = ctx.currentTime;
        if (typeof gain.gain.cancelScheduledValues === 'function') {
          gain.gain.cancelScheduledValues(now);
        }
        if (typeof gain.gain.setValueAtTime === 'function') {
          gain.gain.setValueAtTime(gain.gain.value, now);
        }
        if (typeof gain.gain.linearRampToValueAtTime === 'function') {
          gain.gain.linearRampToValueAtTime(volume, now + fadeInMs / 1000);
        } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), now + fadeInMs / 1000);
        }
        setIsPlayingState(true);
        return;
      }

      try {
        console.log('[EdgeBgm] Starting background music...');
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = ctx.createGain();
        const now = ctx.currentTime;
        if (typeof gain.gain.cancelScheduledValues === 'function') {
          gain.gain.cancelScheduledValues(now);
        }
        if (typeof gain.gain.setValueAtTime === 'function') {
          gain.gain.setValueAtTime(0, now);
        }
        if (typeof gain.gain.linearRampToValueAtTime === 'function') {
          gain.gain.linearRampToValueAtTime(volume, now + fadeInMs / 1000);
        } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), now + fadeInMs / 1000);
        }

        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(0);

        sourceNodeRef.current = source;
        gainNodeRef.current = gain;
        isPlayingRef.current = true;
        setIsPlayingState(true);
      } catch (err) {
        console.error('[EdgeBgm] Failed to start BGM playback:', err);
      }
    },
    [getOrCreateAudioContext, volume, fadeInMs]
  );

  const stopBgm = useCallback(
    (immediate = false) => {
      if (!isPlayingRef.current || !gainNodeRef.current || !audioCtxRef.current) return;

      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      const performFadeAndStop = () => {
        console.log('[EdgeBgm] Stopping background music...');
        const ctx = audioCtxRef.current;
        const gain = gainNodeRef.current;
        const source = sourceNodeRef.current;

        if (!ctx || !gain || !source) return;

        const now = ctx.currentTime;
        if (typeof gain.gain.cancelScheduledValues === 'function') {
          gain.gain.cancelScheduledValues(now);
        }
        if (typeof gain.gain.setValueAtTime === 'function') {
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        }
        if (typeof gain.gain.linearRampToValueAtTime === 'function') {
          gain.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000);
        } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutMs / 1000);
        }

        if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = setTimeout(() => {
          try {
            source.stop();
            source.disconnect();
            gain.disconnect();
          } catch {}

          if (backgroundAudioRef.current) {
            backgroundAudioRef.current.stop();
          }

          isPlayingRef.current = false;
          isManualPlayingRef.current = false;
          sourceNodeRef.current = null;
          gainNodeRef.current = null;
          setIsPlayingState(false);
        }, fadeOutMs);
      };

      if (immediate) {
        performFadeAndStop();
      } else {
        stopTimerRef.current = setTimeout(performFadeAndStop, stopDelayMs);
      }
    },
    [fadeOutMs, stopDelayMs]
  );

  const toggleBgm = useCallback(() => {
    if (isPlayingRef.current) {
      isManualPlayingRef.current = false;
      stopBgm(true);
      setIsPlayingState(false);
    } else {
      isManualPlayingRef.current = true;
      startBgm(true);
    }
  }, [startBgm, stopBgm]);

  // Mobile-aware synchronous user touch & click unlocker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        // Unlock WebAudio on iOS Safari with silent 1-sample buffer
        try {
          const dummy = ctx.createBuffer(1, 1, 22050);
          const node = ctx.createBufferSource();
          node.buffer = dummy;
          node.connect(ctx.destination);
          node.start(0);
        } catch {}
      }

      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.resume();
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
    window.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
    window.addEventListener('click', unlockAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio, { capture: true });
      window.removeEventListener('touchstart', unlockAudio, { capture: true });
      window.removeEventListener('touchend', unlockAudio, { capture: true });
      window.removeEventListener('click', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
    };
  }, [getOrCreateAudioContext]);

  // Preload and decode background audio buffer with AbortController signal
  useEffect(() => {
    if (!enabled || !audioUrl || typeof window === 'undefined') return;

    const controller = new AbortController();
    let isMounted = true;

    const loadAudio = async () => {
      try {
        const resolvedUrl =
          typeof window !== 'undefined' && audioUrl.startsWith('/')
            ? `${window.location.origin}${audioUrl}`
            : audioUrl;

        const response = await fetch(resolvedUrl, { signal: controller.signal });
        const arrayBuffer = await response.arrayBuffer();

        const ctx = getOrCreateAudioContext();
        if (!ctx) return;

        const decoded = await ctx.decodeAudioData(arrayBuffer);

        if (isMounted) {
          if (decoded && decoded.duration > 0.1) {
            audioBufferRef.current = decoded;
          }
          if (isEdgeReadAloudActive() || isManualPlayingRef.current) {
            startBgm(isManualPlayingRef.current);
          }
        } else {
          if (ctx.state !== 'closed') {
            void ctx.close();
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[EdgeBgm] Could not load audio file, using synth ambient fallback:', err);
        }
      }
    };

    void loadAudio();

    return () => {
      isMounted = false;
      controller.abort();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        } catch {}
        sourceNodeRef.current = null;
      }

      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {}
        gainNodeRef.current = null;
      }

      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.stop();
      }

      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      audioBufferRef.current = null;
      isPlayingRef.current = false;
      setIsPlayingState(false);
    };
  }, [audioUrl, enabled, getOrCreateAudioContext, startBgm]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const checkAndToggle = () => {
      if (isEdgeReadAloudActive() || isManualPlayingRef.current) {
        startBgm(isManualPlayingRef.current);
      } else {
        stopBgm();
      }
    };

    checkAndToggle();

    const observer = new MutationObserver(checkAndToggle);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [enabled, startBgm, stopBgm]);

  return {
    isPlaying: isPlayingState,
    toggleBgm,
    startBgm,
    stopBgm,
  };
}
