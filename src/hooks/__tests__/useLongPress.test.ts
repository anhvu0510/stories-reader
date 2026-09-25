// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

describe('useLongPress hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers onLongPress when held longer than threshold', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();

    const { result } = renderHook(() =>
      useLongPress({
        threshold: 400,
        onLongPress,
        onClick,
        haptic: false,
      })
    );

    const mockTouchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockTouchEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    // Simulated click afterwards should be suppressed
    const mockClickEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onClick(mockClickEvent);
    });

    expect(mockClickEvent.preventDefault).toHaveBeenCalled();
    expect(mockClickEvent.stopPropagation).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('cancels long press and calls regular onClick when released early', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();

    const { result } = renderHook(() =>
      useLongPress({
        threshold: 400,
        onLongPress,
        onClick,
        haptic: false,
      })
    );

    const mockTouchEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockTouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(200); // Only 200ms
      result.current.onTouchEnd();
    });

    expect(onLongPress).not.toHaveBeenCalled();

    const mockClickEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onClick(mockClickEvent);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cancels long press if touch moves more than tolerance (scroll detection)', () => {
    const onLongPress = vi.fn();

    const { result } = renderHook(() =>
      useLongPress({
        threshold: 400,
        moveTolerance: 10,
        onLongPress,
        haptic: false,
      })
    );

    const mockTouchStart = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const mockTouchMove = {
      touches: [{ clientX: 100, clientY: 125 }], // Moved 25px in Y
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockTouchStart);
      result.current.onTouchMove(mockTouchMove);
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
