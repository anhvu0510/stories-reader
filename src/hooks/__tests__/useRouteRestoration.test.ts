// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useRouteRestoration, STORAGE_KEY_LAST_ROUTE } from '@/hooks/useRouteRestoration';

describe('useRouteRestoration hook', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('saves the active route when user navigates to a chapter or book screen', () => {
		const navigate = vi.fn();
		const location = { pathname: '/book/b-123/chapter/c-456', search: '', hash: '' };

		renderHook(() => useRouteRestoration({ location: location as any, navigate }));

		const savedRaw = localStorage.getItem(STORAGE_KEY_LAST_ROUTE);
		expect(savedRaw).not.toBeNull();
		const saved = JSON.parse(savedRaw!);
		expect(saved.pathname).toBe('/book/b-123/chapter/c-456');
		expect(saved.timestamp).toBeGreaterThan(0);
	});

	it('restores the last active route on cold start when opening at root path "/"', () => {
		const now = Date.now();
		localStorage.setItem(
			STORAGE_KEY_LAST_ROUTE,
			JSON.stringify({
				pathname: '/book/truyen-1/chapter/chap-10',
				timestamp: now
			})
		);

		const navigate = vi.fn();
		const location = { pathname: '/', search: '', hash: '' };

		renderHook(() => useRouteRestoration({ location: location as any, navigate }));

		expect(navigate).toHaveBeenCalledWith('/book/truyen-1/chapter/chap-10', { replace: true });
	});

	it('does not restore if the saved route is expired (older than 7 days)', () => {
		const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		localStorage.setItem(
			STORAGE_KEY_LAST_ROUTE,
			JSON.stringify({
				pathname: '/book/old-book/chapter/c-1',
				timestamp: eightDaysAgo
			})
		);

		const navigate = vi.fn();
		const location = { pathname: '/', search: '', hash: '' };

		renderHook(() => useRouteRestoration({ location: location as any, navigate }));

		expect(navigate).not.toHaveBeenCalled();
	});

	it('does not restore if the current location is already on a specific page (deep link)', () => {
		const now = Date.now();
		localStorage.setItem(
			STORAGE_KEY_LAST_ROUTE,
			JSON.stringify({
				pathname: '/book/b-1/chapter/c-1',
				timestamp: now
			})
		);

		const navigate = vi.fn();
		const location = { pathname: '/book/deep-link-book', search: '', hash: '' };

		renderHook(() => useRouteRestoration({ location: location as any, navigate }));

		// Nếu người dùng mở trực tiếp một link cụ thể, không được ghi đè bằng route cũ
		expect(navigate).not.toHaveBeenCalled();
	});

	it('updates storage to root "/" when user intentionally navigates back to library', () => {
		const navigate = vi.fn();
		let location = { pathname: '/book/b-1/chapter/c-1', search: '', hash: '' };

		const { rerender } = renderHook(
			({ loc }) => useRouteRestoration({ location: loc as any, navigate }),
			{ initialProps: { loc: location } }
		);

		// Người dùng chủ động back về thư viện
		location = { pathname: '/', search: '', hash: '' };
		rerender({ loc: location });

		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_LAST_ROUTE)!);
		expect(saved.pathname).toBe('/');
	});
});
