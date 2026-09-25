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

  it('synthesizes Web Audio feedback when AudioContext is supported', async () => {
    const { playFeedbackSound } = await import('../useHaptic');

    const mockOscillator = {
      connect: vi.fn(),
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };

    const mockAudioContext = vi.fn().mockImplementation(function (this: any) {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
      this.createOscillator = vi.fn().mockReturnValue(mockOscillator);
      this.createGain = vi.fn().mockReturnValue(mockGain);
      this.resume = vi.fn().mockResolvedValue(undefined);
    });

    (window as any).AudioContext = mockAudioContext;

    const played = playFeedbackSound('selection');
    expect(played).toBe(true);
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });
});
