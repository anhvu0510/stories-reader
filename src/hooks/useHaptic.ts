export type HapticFeedbackType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

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

    // Single unified tactile micro-click for all operations with clear, audible volume
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.start(now);
    osc.stop(now + 0.022);

    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers audio feedback on user tap/click/hold.
 * Hardware vibration has been removed; purely emits clear tactile click sound.
 */
export function triggerHaptic(type: HapticFeedbackType = 'light'): boolean {
  return playFeedbackSound(type);
}

export const triggerSound = triggerHaptic;

export function useHaptic() {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ) === 'function';

  return {
    trigger: triggerHaptic,
    playSound: playFeedbackSound,
    isSupported,
  };
}

export const useSoundFeedback = useHaptic;
