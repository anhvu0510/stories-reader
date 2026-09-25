export type HapticFeedbackType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  selection: 6,
  success: [10, 30, 15],
  warning: [15, 40, 15],
  error: [20, 50, 20, 50, 30],
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Synthesizes short, crisp, low-latency UI click/pop sounds using Web Audio API.
 * Works natively on iOS Safari, Android, Chrome, and Desktop without downloading external files.
 */
export function playFeedbackSound(type: HapticFeedbackType = 'light'): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'selection': {
        // Crisp micro-tick for switching tabs / selecting items
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.012);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
        osc.start(now);
        osc.stop(now + 0.014);
        break;
      }
      case 'light': {
        // Soft tactile tap for standard buttons
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.018);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
      }
      case 'medium': {
        // Warm pop for long-press triggers or opening sheets
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
        osc.start(now);
        osc.stop(now + 0.038);
        break;
      }
      case 'heavy': {
        // Deeper thud for important confirmations
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.052);
        break;
      }
      case 'success': {
        // Gentle pleasant double chime (C5 523Hz -> G5 784Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.06);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.07, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
        break;
      }
      case 'warning':
      case 'error': {
        // Low double alert tone
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(240, now + 0.05);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers tactile & audio feedback:
 * 1. Plays crisp UI micro-sound via Web Audio API (cross-platform: iOS, Android, Desktop).
 * 2. Concurrently triggers hardware vibration if navigator.vibrate is supported.
 */
export function triggerHaptic(type: HapticFeedbackType = 'light'): boolean {
  const soundPlayed = playFeedbackSound(type);

  let vibratePlayed = false;
  if (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      vibratePlayed = navigator.vibrate(HAPTIC_PATTERNS[type]);
    } catch {
      vibratePlayed = false;
    }
  }

  return soundPlayed || vibratePlayed;
}

export function useHaptic() {
  const isSupported =
    typeof window !== 'undefined' &&
    (typeof (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ) === 'function' ||
      (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'));

  return {
    trigger: triggerHaptic,
    playSound: playFeedbackSound,
    isSupported,
  };
}
