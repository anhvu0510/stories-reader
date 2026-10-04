// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useSwipeGesture } from '@/hooks/useSwipeGesture';

describe('useSwipeGesture hook', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
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

	it('allows swipe when user holds touch and drags beyond 800ms (hold-and-drag gesture)', () => {
		const onSwipeLeft = vi.fn();
		const now = 1000000;
		vi.spyOn(Date, 'now').mockReturnValue(now);

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
		});

		// User held finger for 1200ms before releasing at deltaX = -80px
		vi.spyOn(Date, 'now').mockReturnValue(now + 1200);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 155 } as any]
				})
			);
		});

		expect(onSwipeLeft).toHaveBeenCalledTimes(1);
	});

	it('triggers swipe on fast flick/fling when velocity exceeds minVelocity even if distance is below threshold', () => {
		const onSwipeLeft = vi.fn();
		const now = 1000000;
		vi.spyOn(Date, 'now').mockReturnValue(now);

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				threshold: 60,
				minVelocity: 0.3
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 150 } as any]
				})
			);
		});

		// Flick 40px left (less than 60px threshold) within 80ms => velocity = 0.5 px/ms (> 0.3)
		vi.spyOn(Date, 'now').mockReturnValue(now + 80);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 160, clientY: 152 } as any]
				})
			);
		});

		expect(onSwipeLeft).toHaveBeenCalledTimes(1);
	});

	it('reports real-time drag progress during touchmove and settles on touchend', () => {
		const onSwipeLeft = vi.fn();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragEnd = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onDragStart,
				onDragMove,
				onDragEnd,
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
					touches: [{ clientX: 180, clientY: 151 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 140, clientY: 152 } as any]
				})
			);
		});

		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragMove).toHaveBeenLastCalledWith(-60);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 140, clientY: 152 } as any]
				})
			);
		});

		expect(onSwipeLeft).toHaveBeenCalledTimes(1);
		expect(onDragEnd).toHaveBeenCalledWith('left');
	});

	it('cancels drag and calls onDragEnd(cancel) when release distance is below threshold and velocity is low', () => {
		const onSwipeLeft = vi.fn();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragEnd = vi.fn();
		const now = 1000000;
		vi.spyOn(Date, 'now').mockReturnValue(now);

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onDragStart,
				onDragMove,
				onDragEnd,
				threshold: 60,
				minVelocity: 0.35
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
					touches: [{ clientX: 185, clientY: 151 } as any]
				})
			);
		});

		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragMove).toHaveBeenLastCalledWith(-15);

		// Released slowly after 400ms (velocity = 15/400 = 0.037 < 0.35, absX = 15 < 60)
		vi.spyOn(Date, 'now').mockReturnValue(now + 400);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 185, clientY: 151 } as any]
				})
			);
		});

		expect(onSwipeLeft).not.toHaveBeenCalled();
		expect(onDragEnd).toHaveBeenCalledWith('cancel');
	});

	it('cancels drag and calls onDragEnd(cancel) on touchcancel event', () => {
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragEnd = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onDragStart,
				onDragMove,
				onDragEnd,
				threshold: 60
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
					touches: [{ clientX: 170, clientY: 151 } as any]
				})
			);
		});

		expect(onDragStart).toHaveBeenCalledTimes(1);

		act(() => {
			window.dispatchEvent(new TouchEvent('touchcancel'));
		});

		expect(onDragEnd).toHaveBeenCalledWith('cancel');
	});

	it('locks to vertical scrolling when vertical delta exceeds horizontal delta and does not trigger onDragMove', () => {
		const onSwipeLeft = vi.fn();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragEnd = vi.fn();

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onDragStart,
				onDragMove,
				onDragEnd,
				threshold: 50
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 100 } as any]
				})
			);
			// Dominant vertical movement: deltaY = +30px, deltaX = -5px
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 195, clientY: 130 } as any]
				})
			);
			// Subsequent horizontal move after locked vertically
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 120, clientY: 140 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 140 } as any]
				})
			);
		});

		expect(onDragStart).not.toHaveBeenCalled();
		expect(onDragMove).not.toHaveBeenCalled();
		expect(onSwipeLeft).not.toHaveBeenCalled();
		expect(onDragEnd).not.toHaveBeenCalled();
	});

	it('calls onDragEnd with cancel and does not trigger onSwipeLeft when user releases before threshold (snap back)', () => {
		const onSwipeLeft = vi.fn();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragEnd = vi.fn();

		const now = 2000000;
		vi.spyOn(Date, 'now').mockReturnValue(now);

		renderHook(() =>
			useSwipeGesture({
				onSwipeLeft,
				onDragStart,
				onDragMove,
				onDragEnd,
				threshold: 120, // Ngưỡng cam kết lớn
				minVelocity: 0.8
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 200, clientY: 100 } as any]
				})
			);
			// Kéo sang trái 50px (chưa đủ 120px)
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 150, clientY: 100 } as any]
				})
			);
		});

		// Kéo tay tự nhiên trong 200ms => velocity = 50/200 = 0.25 px/ms (< 0.8)
		vi.spyOn(Date, 'now').mockReturnValue(now + 200);

		act(() => {
			// Thả tay ra
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 150, clientY: 100 } as any]
				})
			);
		});

		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragMove).toHaveBeenCalledWith(-50);
		// Không trigger chuyển trang
		expect(onSwipeLeft).not.toHaveBeenCalled();
		// Phải trả về cờ cancel để UI snap back về 0px
		expect(onDragEnd).toHaveBeenCalledWith('cancel');
	});
});

