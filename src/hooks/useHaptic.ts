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
 * Synthesizes a single unified, clean tactile micro-click sound for all UI interactions.
 * Works natively on iOS Safari, Android, Chrome, and Desktop without downloading external files.
 */
export function playFeedbackSound(_type?: HapticFeedbackType): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Single unified tactile micro-click for all operations
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.016);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);

    osc.start(now);
    osc.stop(now + 0.018);

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
