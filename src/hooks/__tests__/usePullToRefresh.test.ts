// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { Capacitor } from '@capacitor/core';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

describe('usePullToRefresh hook', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		window.scrollY = 0;
	});

	afterEach(() => {
		window.scrollY = 0;
	});

	it('initializes with default idle state', () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isRefreshing).toBe(false);
		expect(result.current.isPulling).toBe(false);
		expect(result.current.hasTriggeredThreshold).toBe(false);
	});

	it('does not engage pull if scrolled down (scrollY > 0)', () => {
		window.scrollY = 50;
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			const touchStartEvent = new TouchEvent('touchstart', {
				touches: [{ clientX: 100, clientY: 100 } as any]
			});
			window.dispatchEvent(touchStartEvent);

			const touchMoveEvent = new TouchEvent('touchmove', {
				touches: [{ clientX: 100, clientY: 180 } as any]
			});
			window.dispatchEvent(touchMoveEvent);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
	});

	it('engages pull when scrolled at top (scrollY = 0) and moving downward', () => {
		window.scrollY = 0;
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 60, maxPull: 100 }));

		act(() => {
			const touchStartEvent = new TouchEvent('touchstart', {
				touches: [{ clientX: 100, clientY: 100 } as any]
			});
			window.dispatchEvent(touchStartEvent);

			const touchMoveEvent = new TouchEvent('touchmove', {
				touches: [{ clientX: 100, clientY: 180 } as any],
				cancelable: true
			});
			window.dispatchEvent(touchMoveEvent);
		});

		expect(result.current.pullDistance).toBeGreaterThan(0);
		expect(result.current.isPulling).toBe(true);
	});

	it('aborts pulling on horizontal swipe (deltaX > deltaY)', () => {
		window.scrollY = 0;
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 100 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 160, clientY: 110 } as any],
					cancelable: true
				})
			);
		});

		expect(result.current.isPulling).toBe(false);
		expect(result.current.pullDistance).toBe(0);
	});

	it('resets pull distance on touchend when under threshold', () => {
		window.scrollY = 0;
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 70 }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 100 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 100, clientY: 130 } as any],
					cancelable: true
				})
			);
		});

		expect(result.current.hasTriggeredThreshold).toBe(false);

		act(() => {
			window.dispatchEvent(new TouchEvent('touchend'));
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isRefreshing).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it('triggers onRefresh when released past threshold', async () => {
		window.scrollY = 0;
		let resolveRefresh: () => void = () => {};
		const refreshPromise = new Promise<void>((resolve) => {
			resolveRefresh = resolve;
		});
		const onRefresh = vi.fn().mockReturnValue(refreshPromise);

		const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 50, maxPull: 100, minDisplayTime: 0 }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 100 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 100, clientY: 260 } as any],
					cancelable: true
				})
			);
		});

		expect(result.current.hasTriggeredThreshold).toBe(true);

		act(() => {
			window.dispatchEvent(new TouchEvent('touchend'));
		});

		expect(result.current.isRefreshing).toBe(true);
		expect(onRefresh).toHaveBeenCalled();

		await act(async () => {
			resolveRefresh();
			await refreshPromise;
		});

		expect(result.current.isRefreshing).toBe(false);
		expect(result.current.pullDistance).toBe(0);
	});

	it('respects containerRef scrollTop instead of window.scrollY', () => {
		const div = document.createElement('div');
		div.scrollTop = 80;
		const containerRef = { current: div };
		const onRefresh = vi.fn().mockResolvedValue(undefined);

		const { result } = renderHook(() => usePullToRefresh({ onRefresh, containerRef }));

		act(() => {
			div.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			div.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
	});

	it('does not engage when disabled is true', () => {
		window.scrollY = 0;
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh, disabled: true }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
	});

	it('resets state when reset() is called', () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 50 }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any],
					cancelable: true
				})
			);
		});

		expect(result.current.pullDistance).toBeGreaterThan(0);

		act(() => {
			result.current.reset();
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
		expect(result.current.isRefreshing).toBe(false);
	});

	it('disables pull-to-refresh on web platform by default', () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
		const onRefresh = vi.fn();
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
	});

	it('enables pull-to-refresh on android platform by default', () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		const onRefresh = vi.fn();
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any],
					cancelable: true
				})
			);
		});

		expect(result.current.pullDistance).toBeGreaterThan(0);
		expect(result.current.isPulling).toBe(true);
	});

	it('does not engage pull when body is scroll-locked (overflow-hidden)', () => {
		document.body.classList.add('overflow-hidden');
		const onRefresh = vi.fn();
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
		document.body.classList.remove('overflow-hidden');
	});

	it('does not engage pull when touch starts inside a dialog or bottom sheet', () => {
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		const child = document.createElement('div');
		dialog.appendChild(child);
		document.body.appendChild(dialog);

		const onRefresh = vi.fn();
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

		act(() => {
			child.dispatchEvent(
				new TouchEvent('touchstart', {
					bubbles: true,
					touches: [{ clientX: 50, clientY: 50 } as any]
				})
			);
			child.dispatchEvent(
				new TouchEvent('touchmove', {
					bubbles: true,
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(result.current.pullDistance).toBe(0);
		expect(result.current.isPulling).toBe(false);
		dialog.remove();
	});
});
