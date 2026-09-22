import { useEffect, useRef, useCallback, useState } from 'react';
import { getAssetUrl } from '../shared/utils/assetUrl';
import { generateBgmBufferInWorker } from '../services/bgmAudioWorkerService';

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
 * fallback if physical audio file is missing or worker is unavailable.
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
    const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.12;
    const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.10;
    const note3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.08;
    const wave = (note1 + note2 + note3) * lfo;

    left[i] = wave;
    right[i] = wave;
  }

  return buffer;
}

export function useEdgeReadAloudBgm({
  audioUrl,
  volume = 0.15,
  fadeInMs = 500,
  fadeOutMs = 800,
  stopDelayMs = 1500,
  enabled = true,
}: EdgeReadAloudBgmOptions): EdgeReadAloudBgmReturn {
  const [isPlayingState, setIsPlayingState] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isPlayingRef = useRef(false);
  const isManualPlayingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startBgmRef = useRef<((manual?: boolean) => Promise<void>) | null>(null);

  // Helper to ensure BGM runs on its own isolated AudioContext graph (no HTML5 MediaSession interference)
  const getOrCreateAudioContext = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      return audioCtxRef.current;
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    ctx.onstatechange = () => {
      if (ctx.state === 'running') {
        if (isEdgeReadAloudActive() || isManualPlayingRef.current) {
          if (!sourceNodeRef.current || !isPlayingRef.current) {
            void startBgmRef.current?.(isManualPlayingRef.current);
          }
        }
      }
    };
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  // Set up isolated DynamicsCompressor node to cap dynamic range and prevent mobile volume ducking
  const getOrCreateCompressorNode = useCallback((ctx: AudioContext): AudioNode => {
    if (compressorNodeRef.current) return compressorNodeRef.current;
    if (typeof ctx.createDynamicsCompressor !== 'function') return ctx.destination;

    try {
      const compressor = ctx.createDynamicsCompressor();
      const now = ctx.currentTime;
      if (compressor.threshold && typeof compressor.threshold.setValueAtTime === 'function') {
        compressor.threshold.setValueAtTime(-24, now);
      }
      if (compressor.knee && typeof compressor.knee.setValueAtTime === 'function') {
        compressor.knee.setValueAtTime(30, now);
      }
      if (compressor.ratio && typeof compressor.ratio.setValueAtTime === 'function') {
        compressor.ratio.setValueAtTime(12, now);
      }
      if (compressor.attack && typeof compressor.attack.setValueAtTime === 'function') {
        compressor.attack.setValueAtTime(0.003, now);
      }
      if (compressor.release && typeof compressor.release.setValueAtTime === 'function') {
        compressor.release.setValueAtTime(0.25, now);
      }
      compressor.connect(ctx.destination);
      compressorNodeRef.current = compressor;
      return compressor;
    } catch {
      return ctx.destination;
    }
  }, []);

  const startBgm = useCallback(
    async (manual = false) => {
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
          console.warn('[EdgeBgm] Could not resume isolated AudioContext:', err);
        });
      }

      // Offload synthesis to background Web Worker if buffer is not loaded yet
      let buffer = audioBufferRef.current;
      if (!buffer || buffer.duration < 0.1) {
        buffer = await generateBgmBufferInWorker(ctx);
        if (!buffer) {
          buffer = createSynthesizedAmbientBuffer(ctx);
        }
        audioBufferRef.current = buffer;
      }

      // Cap volume strictly to safe auxiliary background level (max 0.25) so BGM never conflicts with speech
      const safeVolume = Math.min(Math.max(volume, 0), 0.25);

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
          gain.gain.linearRampToValueAtTime(safeVolume, now + fadeInMs / 1000);
        } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(Math.max(safeVolume, 0.0001), now + fadeInMs / 1000);
        }
        setIsPlayingState(true);
        return;
      }

      try {
        console.log('[EdgeBgm] Starting background music in isolated WebAudio graph...');
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
          gain.gain.linearRampToValueAtTime(safeVolume, now + fadeInMs / 1000);
        } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(Math.max(safeVolume, 0.0001), now + fadeInMs / 1000);
        }

        const compressorOrDest = getOrCreateCompressorNode(ctx);
        source.connect(gain);
        gain.connect(compressorOrDest);

        source.start(0);

        sourceNodeRef.current = source;
        gainNodeRef.current = gain;
        isPlayingRef.current = true;
        setIsPlayingState(true);
      } catch (err) {
        console.error('[EdgeBgm] Failed to start isolated BGM playback:', err);
      }
    },
    [getOrCreateAudioContext, getOrCreateCompressorNode, volume, fadeInMs]
  );

  useEffect(() => {
    startBgmRef.current = startBgm;
  }, [startBgm]);

  const stopBgm = useCallback(
    (immediate = false) => {
      if (!isPlayingRef.current || !gainNodeRef.current || !audioCtxRef.current) return;

      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      const performFadeAndStop = () => {
        console.log('[EdgeBgm] Stopping isolated background music...');
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
      void startBgm(true);
    }
  }, [startBgm, stopBgm]);

  // Mobile-aware synchronous user touch & click unlocker for isolated AudioContext
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          void ctx.resume().then(() => {
            if (isEdgeReadAloudActive() || isManualPlayingRef.current) {
              if (!sourceNodeRef.current || !isPlayingRef.current) {
                void startBgmRef.current?.(isManualPlayingRef.current);
              }
            }
          }).catch(() => {});
        } else if (ctx.state === 'running') {
          if (isEdgeReadAloudActive() || isManualPlayingRef.current) {
            if (!sourceNodeRef.current || !isPlayingRef.current) {
              void startBgmRef.current?.(isManualPlayingRef.current);
            }
          }
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
        const resolvedUrl = getAssetUrl(audioUrl);
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
            void startBgm(isManualPlayingRef.current);
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

      if (compressorNodeRef.current) {
        try {
          compressorNodeRef.current.disconnect();
        } catch {}
        compressorNodeRef.current = null;
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
        void startBgm(isManualPlayingRef.current);
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
