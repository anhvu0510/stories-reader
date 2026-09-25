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

/**
 * Triggers a vibration pattern if supported by the browser/device.
 */
export function triggerHaptic(type: HapticFeedbackType = 'light'): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (typeof navigator.vibrate !== 'function') {
    return false;
  }

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[type]);
  } catch {
    return false;
  }
}

export function useHaptic() {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function';

  return {
    trigger: triggerHaptic,
    isSupported,
  };
}
