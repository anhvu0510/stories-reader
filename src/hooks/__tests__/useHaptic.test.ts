// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { triggerHaptic, useHaptic } from '../useHaptic';

describe('useHaptic & triggerHaptic', () => {
  const originalVibrate = window.navigator?.vibrate;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'vibrate', {
      value: originalVibrate,
      configurable: true,
      writable: true,
    });
  });

  it('returns false when navigator.vibrate is not available', () => {
    Object.defineProperty(window.navigator, 'vibrate', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const result = triggerHaptic('light');
    expect(result).toBe(false);
  });

  it('calls navigator.vibrate with correct pattern when supported', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    const result = triggerHaptic('light');
    expect(result).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(8);

    triggerHaptic('success');
    expect(vibrateMock).toHaveBeenCalledWith([10, 30, 15]);
  });

  it('useHaptic hook provides trigger and isSupported status', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useHaptic());
    expect(result.current.isSupported).toBe(true);

    act(() => {
      const res = result.current.trigger('medium');
      expect(res).toBe(true);
    });
    expect(vibrateMock).toHaveBeenCalledWith(15);
  });
});
