export type HapticFeedbackType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

// Enforce hardware vibration block globally to prevent any native or 3rd-party vibration
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  try {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => false,
      configurable: true,
      writable: true,
    });
  } catch {
    // ignore if locked
  }
}

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
 * Synthesizes a crisp, clear, high-frequency tactile tick using Web Audio API.
 * Tuned above 850Hz to guarantee zero physical chassis vibration or mobile audio-haptic resonance.
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

    // High-frequency crisp click (1800Hz -> 850Hz in 14ms)
    // Avoids frequencies < 800Hz so phone body / speaker frame does not physically resonate
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.014);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    osc.start(now);
    osc.stop(now + 0.015);

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
