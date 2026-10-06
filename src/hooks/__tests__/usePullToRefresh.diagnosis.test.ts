// @vitest-environment jsdom
// Known failures, reproduced as ordinary failing tests before being marked here.
// User requested a refactor plan, not implementation. These remain active as
// expected-failure contracts: remove .fails when implementing the approved plan.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { usePullToRefresh } from '../usePullToRefresh';

function touch(type: string, y: number, target: EventTarget = window): void {
	const point = { clientX: 100, clientY: y, identifier: 1 } as Touch;
	target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [point] }));
}

describe('pull-to-refresh diagnosis before proposed Android refactor', () => {
	beforeEach(() => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		window.scrollY = 0;
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it.fails('cancellation after arming must never refresh', () => {
		const onRefresh = vi.fn();
		renderHook(() => usePullToRefresh({ onRefresh, minDisplayTime: 0 }));
		act(() => { touch('touchstart', 100); touch('touchmove', 300); touch('touchcancel', 300); });
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it.fails('retracting an armed pull to its origin must disarm refresh', () => {
		const onRefresh = vi.fn();
		renderHook(() => usePullToRefresh({ onRefresh, minDisplayTime: 0 }));
		act(() => { touch('touchstart', 100); touch('touchmove', 300); touch('touchmove', 100); touch('touchend', 100); });
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it.fails('dragging an interactive read-aloud control must not start refreshing', () => {
		const handle = document.createElement('button');
		handle.setAttribute('aria-label', 'Kéo thanh điều khiển lên hoặc xuống');
		document.body.appendChild(handle);
		const onRefresh = vi.fn();
		renderHook(() => usePullToRefresh({ onRefresh, minDisplayTime: 0 }));
		act(() => { touch('touchstart', 100, handle); touch('touchmove', 300, handle); touch('touchend', 300, handle); });
		handle.remove();
		expect(onRefresh).not.toHaveBeenCalled();
	});
});
