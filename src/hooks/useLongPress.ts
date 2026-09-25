import React, { useRef, useCallback } from 'react';
import { triggerHaptic } from './useHaptic';

export interface UseLongPressOptions {
  /**
   * Duration in ms before long press is triggered.
   * Defaults to 400ms.
   */
  threshold?: number;
  /**
   * Distance in pixels to allow touch movement before cancelling long press (e.g. when scrolling).
   * Defaults to 10px.
   */
  moveTolerance?: number;
  /**
   * Callback fired when long press threshold is reached.
   */
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  /**
   * Optional callback fired when element is clicked normally (not long-pressed).
   */
  onClick?: (e: React.MouseEvent) => void;
  /**
   * Whether to trigger medium haptic feedback on long press trigger. Defaults to true.
   */
  haptic?: boolean;
}

export function useLongPress({
  threshold = 400,
  moveTolerance = 10,
  onLongPress,
  onClick,
  haptic = true,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetEventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressedRef.current = false;
      targetEventRef.current = e;

      if ('touches' in e && e.touches.length > 0) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if ('clientX' in e) {
        startPosRef.current = {
          x: e.clientX,
          y: e.clientY,
        };
      }

      timerRef.current = setTimeout(() => {
        isLongPressedRef.current = true;
        if (haptic) {
          triggerHaptic('medium');
        }
        if (targetEventRef.current) {
          onLongPress(targetEventRef.current);
        }
      }, threshold);
    },
    [threshold, onLongPress, haptic]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!timerRef.current || !startPosRef.current) return;

      let currentX = 0;
      let currentY = 0;

      if ('touches' in e && e.touches.length > 0) {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        currentX = e.clientX;
        currentY = e.clientY;
      }

      const deltaX = Math.abs(currentX - startPosRef.current.x);
      const deltaY = Math.abs(currentY - startPosRef.current.y);

      // If user moved finger more than tolerance, they are scrolling -> cancel immediately
      if (deltaX > moveTolerance || deltaY > moveTolerance) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    },
    [moveTolerance]
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isLongPressedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        isLongPressedRef.current = false;
        return;
      }
      onClick?.(e);
    },
    [onClick]
  );

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: clear,
    onMouseLeave: clear,
    onClick: handleClick,
  };
}
