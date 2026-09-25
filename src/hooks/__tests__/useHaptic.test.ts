// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { triggerHaptic, triggerSound, useHaptic, playFeedbackSound } from '../useHaptic';

describe('useHaptic & sound feedback', () => {
  const originalAudioContext = (window as any).AudioContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
  });

  it('returns false when AudioContext is not available', () => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;

    const result = triggerHaptic('light');
    expect(result).toBe(false);
  });

  it('synthesizes Web Audio click when AudioContext is supported', () => {
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
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalledWith(0.12, 0);
  });

  it('useHaptic hook provides trigger, playSound, and isSupported status', () => {
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

    const { result } = renderHook(() => useHaptic());
    expect(result.current.isSupported).toBe(true);

    act(() => {
      const res = result.current.trigger('medium');
      expect(res).toBe(true);
    });

    expect(triggerSound).toBe(triggerHaptic);
  });
});
