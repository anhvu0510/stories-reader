// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useReadingWakeLock } from '../readAloud/useReadingWakeLock';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function deferredLock() {
	const release = vi.fn(async () => {});
	const sentinel: WakeLockSentinel = Object.assign(new EventTarget(), { type: 'screen' as const, released: false, onrelease: null, release });
	let resolve: (lock: WakeLockSentinel) => void = () => {};
	const promise = new Promise<WakeLockSentinel>((done) => {
		resolve = done;
	});
	const request = vi.fn(() => promise);
	vi.stubGlobal('navigator', { wakeLock: { request } });
	return { request, sentinel, release, resolve };
}

describe('reading wake lock ownership', () => {
	it('releases a late screen lock when reading was stopped before acquisition', async () => {
		const lock = deferredLock();
		const { result } = renderHook(() => useReadingWakeLock());
		const pending = result.current.requestWakeLock();
		result.current.releaseWakeLock();
		await act(async () => {
			lock.resolve(lock.sentinel);
			await pending;
		});
		expect(lock.release).toHaveBeenCalledTimes(1);
	});
	it('coalesces repeated requests while acquisition is pending', async () => {
		const lock = deferredLock();
		const { result } = renderHook(() => useReadingWakeLock());
		const pending = result.current.requestWakeLock();
		void result.current.requestWakeLock();
		expect(lock.request).toHaveBeenCalledTimes(1);
		await act(async () => {
			lock.resolve(lock.sentinel);
			await pending;
		});
	});
});
