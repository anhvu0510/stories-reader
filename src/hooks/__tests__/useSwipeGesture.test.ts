// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSwipeGesture } from '@/hooks/useSwipeGesture';

describe('useSwipeGesture hook', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('triggers onSwipeLeft when user swipes from right to left horizontally', () => {
		const onSwipeLeft = vi.fn();
		const onSwipeRight = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onSwipeRight,
				threshold: 50
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 120, clientY: 155 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 155 } as any]
				})
			);
		});

		expect(onSwipeLeft).toHaveBeenCalledTimes(1);
		expect(onSwipeRight).not.toHaveBeenCalled();
	});

	it('triggers onSwipeRight when user swipes from left to right horizontally', () => {
		const onSwipeLeft = vi.fn();
		const onSwipeRight = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onSwipeRight,
				threshold: 50
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 180, clientY: 155 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 180, clientY: 155 } as any]
				})
			);
		});

		expect(onSwipeRight).toHaveBeenCalledTimes(1);
		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it('ignores touchstart within edgeIgnoreWidth (< 28px) to preserve native edge back gesture', () => {
		const onSwipeRight = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeRight,
				threshold: 50,
				edgeIgnoreWidth: 28
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 15, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 100, clientY: 150 } as any]
				})
			);
		});

		expect(onSwipeRight).not.toHaveBeenCalled();
	});

	it('ignores swipe when vertical scrolling is dominant (deltaY > deltaX)', () => {
		const onSwipeLeft = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				threshold: 50
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 100 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 130, clientY: 250 } as any]
				})
			);
		});

		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it('does not trigger swipe when text is actively selected', () => {
		const onSwipeLeft = vi.fn();

		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			toString: () => 'Đoạn văn được chọn'
		} as any);

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				threshold: 50
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 155 } as any]
				})
			);
		});

		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it('does not trigger swipe when disabled is true', () => {
		const onSwipeLeft = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				threshold: 50,
				disabled: true
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 155 } as any]
				})
			);
		});

		expect(onSwipeLeft).not.toHaveBeenCalled();
	});
});

